// Full page Quotebook interface

class FullPageCollector {
  constructor() {
    this.accessToken = null;
    this.spreadsheetId = null;
    this.contentData = [];
    this.filteredData = [];
    this.init();
  }

  async init() {
    console.log("Initializing Full Page Collector...");

    // Wait a moment for storage to sync from popup
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check for cached authentication data with multiple attempts
    let result = await chrome.storage.local.get([
      "googleAccessToken",
      "googleSpreadsheetId",
    ]);

    // If no data found, try a few more times with delays (popup may have just saved)
    for (
      let attempt = 0;
      attempt < 3 && (!result.googleAccessToken || !result.googleSpreadsheetId);
      attempt++
    ) {
      console.log(`Storage attempt ${attempt + 1}: waiting for sync...`);
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
      result = await chrome.storage.local.get([
        "googleAccessToken",
        "googleSpreadsheetId",
      ]);
    }

    console.log("Fullpage cached data:", {
      hasSpreadsheetId: !!result.googleSpreadsheetId,
      hasAccessToken: !!result.googleAccessToken,
      spreadsheetId: result.googleSpreadsheetId,
    });

    if (result.googleAccessToken && result.googleSpreadsheetId) {
      console.log(
        "Testing cached spreadsheet in fullpage:",
        result.googleSpreadsheetId,
      );
      // Verify the spreadsheet still exists and is not trashed
      try {
        // Check if file is trashed using Drive API
        const driveResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${result.googleSpreadsheetId}?fields=trashed,name`,
          {
            headers: { Authorization: `Bearer ${result.googleAccessToken}` },
          },
        );

        console.log("Fullpage Drive API test response:", driveResponse.status);

        if (driveResponse.ok) {
          const fileInfo = await driveResponse.json();
          console.log("Fullpage file info:", fileInfo);

          if (fileInfo.trashed === true) {
            console.log("Fullpage spreadsheet is in trash, clearing cache");
            await chrome.storage.local.remove([
              "googleSpreadsheetId",
              "googleAccessToken",
            ]);
            this.showAuthRequired();
          } else {
            // File exists and is not trashed, verify it's still accessible via Sheets API
            const sheetsResponse = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${result.googleSpreadsheetId}`,
              {
                headers: {
                  Authorization: `Bearer ${result.googleAccessToken}`,
                },
              },
            );

            if (sheetsResponse.ok) {
              console.log(
                "Fullpage spreadsheet verified and accessible, loading content",
              );
              this.accessToken = result.googleAccessToken;
              this.spreadsheetId = result.googleSpreadsheetId;
              this.updateSpreadsheetLink();
              await this.loadContent();
            } else {
              console.log(
                "Fullpage spreadsheet not accessible via Sheets API, clearing cache",
              );
              await chrome.storage.local.remove([
                "googleSpreadsheetId",
                "googleAccessToken",
              ]);
              this.showAuthRequired();
            }
          }
        } else {
          // File not found or not accessible, clear cache and show auth
          console.log(
            "Fullpage file not accessible via Drive API, clearing cache",
          );
          await chrome.storage.local.remove([
            "googleSpreadsheetId",
            "googleAccessToken",
          ]);
          this.showAuthRequired();
        }
      } catch (error) {
        // Error accessing spreadsheet, clear cache and show auth
        console.log("Fullpage error testing spreadsheet:", error);
        await chrome.storage.local.remove([
          "googleSpreadsheetId",
          "googleAccessToken",
        ]);
        this.showAuthRequired();
      }
    } else {
      console.log("No cached data found after retries, showing auth required");
      this.showAuthRequired();
    }

    this.setupEventListeners();
  }

  setupEventListeners() {
    const searchInput = document.getElementById("searchInput");
    const tagFilter = document.getElementById("tagFilter");
    const dateFilter = document.getElementById("dateFilter");
    const authButton = document.getElementById("auth-button");
    const spreadsheetLink = document.getElementById("spreadsheet-link");

    if (searchInput) {
      searchInput.addEventListener("input", () => this.applyFilters());
    }
    if (tagFilter) {
      tagFilter.addEventListener("change", () => this.applyFilters());
    }
    if (dateFilter) {
      dateFilter.addEventListener("change", () => this.applyFilters());
    }
    if (authButton) {
      authButton.addEventListener("click", () => this.authenticateWithGoogle());
    }
    if (spreadsheetLink) {
      spreadsheetLink.addEventListener("click", (e) => {
        e.preventDefault();
        if (this.spreadsheetId) {
          window.open(`https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`, '_blank');
        }
      });
    }
  }

  async authenticateWithGoogle() {
    try {
      console.log("Starting authentication...");

      // Clear any existing cached data when re-authenticating
      await chrome.storage.local.remove([
        "googleSpreadsheetId",
        "googleAccessToken",
      ]);

      const redirectURL = chrome.identity.getRedirectURL();
      const clientId =
        "184152653641-m443n0obiua9uotnkts6lsbbo8ikks80.apps.googleusercontent.com";
      const scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive.readonly",
      ];
      let authURL = "https://accounts.google.com/oauth2/authorize";
      authURL += `?client_id=${clientId}`;
      authURL += `&response_type=token`;
      authURL += `&redirect_uri=${encodeURIComponent(redirectURL)}`;
      authURL += `&scope=${encodeURIComponent(scopes.join(" "))}`;

      const result = await chrome.identity.launchWebAuthFlow({
        url: authURL,
        interactive: true,
      });

      const url = new URL(result);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get("access_token");

      if (!accessToken) {
        throw new Error("No access token received");
      }

      this.accessToken = accessToken;

      // Create or find spreadsheet
      const spreadsheetId = await this.setupSpreadsheet();
      this.spreadsheetId = spreadsheetId;

      // Save to storage
      await chrome.storage.local.set({
        googleAccessToken: accessToken,
        googleSpreadsheetId: spreadsheetId,
      });

      await this.loadContent();
      console.log("Authentication successful!");
    } catch (error) {
      console.error("Authentication failed:", error);
      alert("Authentication failed. Please try again.");
    }
  }

  async setupSpreadsheet() {
    try {
      console.log("Looking for existing Quotebook spreadsheet...");

      // Search for existing Quotebook spreadsheets
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name contains 'Quotebook' and mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name,createdTime)`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const existingSheets = searchData.files || [];

        if (existingSheets.length > 0) {
          // Sort by creation date (newest first)
          existingSheets.sort(
            (a, b) => new Date(b.createdTime) - new Date(a.createdTime),
          );

          console.log(
            `Found existing spreadsheet: "${existingSheets[0].name}"`,
          );
          return existingSheets[0].id;
        }
      }

      // No existing spreadsheet found, create a new one
      console.log("Creating new Quotebook spreadsheet...");

      const createResponse = await fetch(
        "https://sheets.googleapis.com/v4/spreadsheets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: {
              title: "Quotebook Collection",
            },
            sheets: [
              {
                properties: {
                  title: "Saved Quotes",
                },
              },
            ],
          }),
        },
      );

      const spreadsheet = await createResponse.json();
      const spreadsheetId = spreadsheet.spreadsheetId;

      // Add headers
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:F1?valueInputOption=RAW`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            values: [["Title", "Content", "URL", "Tags", "Date", "Image"]],
          }),
        },
      );

      console.log("New Quotebook spreadsheet created!");
      return spreadsheetId;
    } catch (error) {
      console.error("Failed to setup spreadsheet:", error);
      throw error;
    }
  }

  async loadContent() {
    try {
      this.showLoading(true);

      // First verify the spreadsheet exists
      const verifyResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}`,
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        },
      );

      if (!verifyResponse.ok) {
        if (verifyResponse.status === 404) {
          console.log(
            "Spreadsheet was deleted, clearing storage and requiring re-authentication",
          );
          await chrome.storage.local.remove([
            "googleSpreadsheetId",
            "googleAccessToken",
          ]);
          this.showAuthRequired();
          return;
        }
        throw new Error(
          `Failed to verify spreadsheet: ${verifyResponse.status}`,
        );
      }

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/A2:F1000`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log(
            "Spreadsheet was deleted, clearing storage and requiring re-authentication",
          );
          await chrome.storage.local.remove([
            "googleSpreadsheetId",
            "googleAccessToken",
          ]);
          this.showAuthRequired();
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const rows = data.values || [];

      this.contentData = rows.map((row, index) => ({
        id: index, // 0-based index in the data array
        rowNumber: index + 2, // Actual spreadsheet row number (row 1 is header, data starts at row 2)
        title: row[0] || "Untitled",
        content: row[1] || "",
        url: row[2] || "",
        tags: row[3]
          ? row[3]
              .split(",")
              .map((tag) => tag.trim())
              .filter((tag) => tag)
          : [],
        date: row[4] || new Date().toISOString().split("T")[0],
        image: row[5] || "",
      }));

      this.filteredData = [...this.contentData];
      this.renderStats();
      this.renderTagFilter();
      this.renderContent();
      this.showLoading(false);
    } catch (error) {
      console.error("Failed to load content:", error);
      this.showLoading(false);
      if (error.message.includes("401")) {
        this.showAuthRequired();
      }
    }
  }

  attachEventListeners() {
    // Delete button event listeners
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const itemId = btn.getAttribute("data-item-id");
        this.deleteItem(parseInt(itemId));
      });
    });

    // Tag pill event listeners
    document.querySelectorAll(".tag-pill").forEach((pill) => {
      pill.addEventListener("click", (e) => {
        e.preventDefault();
        const tag = pill.getAttribute("data-tag");
        document.getElementById("tagFilter").value = tag;
        this.applyFilters();
      });
    });
  }

  async deleteItem(itemId) {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      console.log("Deleting item with ID:", itemId);

      // Find the item in our data array
      const item = this.contentData.find((item) => item.id === itemId);
      if (!item) {
        console.error("Item not found:", itemId);
        return;
      }

      const rowNumber = item.rowNumber; // This is the actual spreadsheet row number
      console.log("Deleting spreadsheet row:", rowNumber);

      // Delete row from spreadsheet (convert to 0-based index for API)
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: 0,
                    dimension: "ROWS",
                    startIndex: rowNumber - 1, // Convert to 0-based index for API
                    endIndex: rowNumber, // endIndex is exclusive
                  },
                },
              },
            ],
          }),
        },
      );

      if (response.ok) {
        console.log("Item deleted successfully");
        // Reload content to refresh the display
        await this.loadContent();
      } else {
        const errorData = await response.json();
        console.error("Delete failed:", errorData);
        alert("Failed to delete item. Please try again.");
      }
    } catch (error) {
      console.error("Failed to delete item:", error);
      alert("Failed to delete item. Please try again.");
    }
  }

  renderStats() {
    const statsContainer = document.getElementById("stats");
    const totalItems = this.contentData.length;
    const totalTags = [
      ...new Set(this.contentData.flatMap((item) => item.tags)),
    ].length;
    const thisMonth = this.contentData.filter((item) => {
      const itemDate = new Date(item.date);
      const now = new Date();
      return (
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getFullYear() === now.getFullYear()
      );
    }).length;
    const uniqueWebsites = [
      ...new Set(
        this.contentData.map((item) => {
          try {
            return new URL(item.url).hostname;
          } catch {
            return "Unknown";
          }
        }),
      ),
    ].length;

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-number">${totalItems}</div>
        <div class="stat-label">Quotes</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${totalTags}</div>
        <div class="stat-label">Tags</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${thisMonth}</div>
        <div class="stat-label">This Month</div>
      </div>
    `;
  }

  renderTagFilter() {
    const tagFilter = document.getElementById("tagFilter");
    const allTags = [
      ...new Set(this.contentData.flatMap((item) => item.tags)),
    ].sort();

    tagFilter.innerHTML = '<option value="">All Tags</option>';
    allTags.forEach((tag) => {
      const option = document.createElement("option");
      option.value = tag;
      option.textContent = tag;
      tagFilter.appendChild(option);
    });
  }

  applyFilters() {
    const searchTerm = document
      .getElementById("searchInput")
      .value.toLowerCase();
    const selectedTag = document.getElementById("tagFilter").value;
    const dateRange = document.getElementById("dateFilter").value;

    this.filteredData = this.contentData.filter((item) => {
      // Search filter
      const matchesSearch =
        !searchTerm ||
        item.title.toLowerCase().includes(searchTerm) ||
        item.content.toLowerCase().includes(searchTerm) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchTerm));

      // Tag filter
      const matchesTag = !selectedTag || item.tags.includes(selectedTag);

      // Date filter
      let matchesDate = true;
      if (dateRange) {
        const itemDate = new Date(item.date);
        const now = new Date();
        switch (dateRange) {
          case "today":
            matchesDate = itemDate.toDateString() === now.toDateString();
            break;
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = itemDate >= weekAgo;
            break;
          case "month":
            matchesDate =
              itemDate.getMonth() === now.getMonth() &&
              itemDate.getFullYear() === now.getFullYear();
            break;
        }
      }

      return matchesSearch && matchesTag && matchesDate;
    });

    this.renderContent();
  }

  renderContent() {
    const contentContainer = document.getElementById("content");
    const noResults = document.getElementById("no-results");

    if (this.filteredData.length === 0) {
      contentContainer.style.display = "none";
      noResults.style.display = "block";
      return;
    }

    contentContainer.style.display = "block";
    noResults.style.display = "none";

    contentContainer.innerHTML = this.filteredData
      .map(
        (item) => `
      <div class="content-card" data-item-id="${item.id}">
        <div class="content-actions">
          <button class="delete-btn" data-item-id="${item.id}" title="Delete">
            🗑️
          </button>
        </div>
        
        ${item.image ? `<img src="${item.image}" alt="" class="content-image">` : ""}
        
        <a href="${item.url}" target="_blank" class="content-title">
          ${this.escapeHtml(item.title)}
        </a>
        
        <div class="content-text">
          ${this.escapeHtml(item.content)}
        </div>
        
        ${
          item.tags.length > 0
            ? `
          <div class="content-tags">
            ${item.tags
              .map(
                (tag) => `
              <span class="tag-pill" data-tag="${this.escapeHtml(tag)}">
                ${this.escapeHtml(tag)}
              </span>`,
              )
              .join("")}
          </div>
        `
            : ""
        }
        
        <div class="content-meta">
          <span class="content-domain">${this.getDomain(item.url)}</span>
          <time class="content-date">${item.date}</time>
        </div>
      </div>
    `,
      )
      .join("");

    // Add event listeners for delete buttons and tag pills
    this.attachEventListeners();
  }

  renderNoResults() {
    return `
      <div id="no-results" style="display: none;">
        <div style="text-align: center; padding: 60px 20px; color: hsl(25, 5.3%, 44.7%);">
          <h3 style="color: hsl(220, 30%, 18%); margin-bottom: 12px;">No content found</h3>
          <p>Try adjusting your search terms or filters</p>
        </div>
      </div>
    `;
  }

  getDomain(url) {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "Unknown";
    }
  }

  formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showLoading(show) {
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");
    const stats = document.getElementById("stats");
    const authRequired = document.getElementById("auth-required");

    if (show) {
      loading.style.display = "block";
      content.style.display = "none";
      stats.style.display = "none";
      authRequired.style.display = "none";
    } else {
      loading.style.display = "none";
      stats.style.display = "flex";
    }
  }

  showAuthRequired() {
    const loading = document.getElementById("loading");
    const content = document.getElementById("content");
    const stats = document.getElementById("stats");
    const authRequired = document.getElementById("auth-required");
    const spreadsheetLink = document.getElementById("spreadsheet-link");

    loading.style.display = "none";
    content.style.display = "none";
    stats.style.display = "none";
    authRequired.style.display = "block";
    if (spreadsheetLink) spreadsheetLink.style.display = "none";
  }

  updateSpreadsheetLink() {
    const spreadsheetLink = document.getElementById('spreadsheet-link');
    if (spreadsheetLink && this.spreadsheetId) {
      spreadsheetLink.href = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/edit`;
      spreadsheetLink.style.display = 'flex';
    } else if (spreadsheetLink) {
      spreadsheetLink.style.display = 'none';
    }
  }
}

// Global functions
window.selectTag = function (tag) {
  const tagFilter = document.getElementById("tagFilter");
  tagFilter.value = tag;
  fullPageCollector.applyFilters();
};

window.authenticateWithGoogle = function () {
  fullPageCollector.authenticateWithGoogle();
};

// Initialize when page loads
let fullPageCollector;
document.addEventListener("DOMContentLoaded", () => {
  fullPageCollector = new FullPageCollector();
});
