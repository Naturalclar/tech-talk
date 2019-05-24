#!/usr/bin/env ts-node

const [dir] = process.argv.slice(2)
const oEmbed = {
  type: 'rich',
  version: '1.0',
  provider_name: 'slides.naturalclar.com',
  provider_url: 'https://slides.naturalclar.com',
  title: '',
  width: 658,
  height: 408,
  html: `<iframe style="width: 100%; overflow: hidden;" src="https://slides.naturalclar.com/${dir}/index.html" width="658" height="408" frameborder="0" scrolling="no" ></iframe>`,
}

console.log(JSON.stringify(oEmbed))
