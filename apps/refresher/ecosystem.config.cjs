module.exports = {
  apps: [
    {
      name: 'qbo-refresher',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        API_BASE: 'https://www.wemakemarin.com',
        QBO_CRON_SECRET: 's9fnn93n9fnsfon',
        REFRESHER_PORT: '8090'
      }
    }
  ]
}

