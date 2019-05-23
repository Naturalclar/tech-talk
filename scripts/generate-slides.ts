#!/usr/bin/env ts-node

import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

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
  exec(`yarn rimraf ./dist`)
  exec(`yarn cpx ./src/assets ./dist/assets`)
  mdxs.forEach(mdx => {
    const title = getTitle(mdx)
    // build mdx files to separate folders
    try {
      exec(`yarn build:mdx ${mdx} --out-dir ./dist/${title}`, (err)=> {
        if (err) {
          // if error is caught, clean and rebuild with no-html flag
          exec(`yarn rimraf ./dist/${title}`)
          exec(`yarn build:mdx --no-html ${mdx} --out-dir ./dist/${title}`)
        }
      })
    } catch(err) {
      console.log(err.message)
    }

  })
  // move all assets to dist
  exec(`yarn build:assets`)
}
main()
