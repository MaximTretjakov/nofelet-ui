// vue.config.js
const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
   publicPath: process.env.NODE_ENV === 'production'
    ? '/nofelet-ui/'
    : '/',
  outputDir: 'dist',
  assetsDir: 'static'
})