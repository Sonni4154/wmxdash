module.exports = {
  apps: [{
    name: "qbo-refresher",
    script: "./dist/index.js",
    cwd: "/opt/wmx/apps/refresher",
    env: {
      API_BASE: "https://www.wemakemarin.com",
      QBO_CRON_SECRET: "YOUR_SECRET"
    }
  }]
}

