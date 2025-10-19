module.exports = {
  apps: [
    {
      name: "mdrdr2-server",
      script: "dist/index.js",
      cwd: "./server",
      env_file: "./server/.env",
      env: {
        NODE_ENV: "production",
        PORT: 3001
      }
    },
    {
      name: "mdrdr2-web",
      script: "npx",
      args: "serve -s dist -l 3000",
      cwd: "./web",
      env: { NODE_ENV: "production" }
    },
    {
      name: "mdrdr2-admin",
      script: "npx",
      args: "serve -s dist -l 5174",
      cwd: "./mdrdr-admin",
      env: { NODE_ENV: "production" }
    }
  ]
};
