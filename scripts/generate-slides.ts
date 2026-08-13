#!/usr/bin/env ts-node

import fs from 'fs'
import path from 'path'
import { exec, execSync } from 'child_process'

// recursively get files of given path
const listDir = (dir: string, list: string[] = []): string[] => {
  let fileList = list
  const files = fs.readdirSync(dir)
  files.forEach(file => {
    const dirPath = path.join(dir, file)
    if (fs.statSync(dirPath).isDirectory()) {
      fileList = listDir(dirPath, fileList)
    } else {
      fileList = fileList.concat(dirPath)
    }
  })
  return fileList
}

// get the name of folder that contains given dirpath
const getTitle = (dir: string): string => {
  return path.basename(path.dirname(dir))
}

const main = () => {
  if (process.argv.length < 3) {
    console.log('usage: ./generate-slides [dirname]')
    return
  }

  const dirname = process.argv[2]

  // filter files that ends with .mdx
  const mdxs = listDir(dirname).filter(file => {
    return path.extname(file) === '.mdx'
  })

  // clean
  exec(`pnpm exec rimraf ./dist`)
  exec(`pnpm exec cpx ./src/assets ./dist/assets`)
  let template = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'index.html'),
    'utf8'
  )
  mdxs.forEach(mdx => {
    const title = getTitle(mdx)
    // build mdx files to separate folders
    exec(`pnpm run build:mdx ${mdx} --out-dir ./dist/${title}`, err => {
      if (err) {
        // if error is caught, clean and rebuild with no-html flag
        exec(`pnpm exec rimraf ./dist/${title}`)
        exec(`pnpm run build:mdx --no-html ${mdx} --out-dir ./dist/${title}`)
      }
    })
    execSync(`pnpm run build:screenshot ${mdx} --out-file ${title}.png`)
    // --silent keeps pnpm's own banner out of the redirected stdout
    exec(
      `pnpm run --silent build:oembed ${title} > ./dist/${title}/oembed.json`
    )
    exec(`pnpm run --silent build:index ${title}`, (err, stdout) => {
      template = template.replace(
        '<!--REPLACE_ME-->',
        `${stdout}<!--REPLACE_ME-->`
      )
      fs.writeFileSync(
        path.join(__dirname, '..', 'dist', 'index.html'),
        template,
        'utf8'
      )
    })
  })
  // move all assets to dist
  exec(`pnpm run build:assets`)
  exec(`pnpm exec cpx ./src/_redirects ./dist`)
}
main()
