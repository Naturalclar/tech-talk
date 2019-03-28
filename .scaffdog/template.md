---
name: "new-slide"
description: "Create new slide"
message: "Enter Title of your Slide"
root: "./src"
output: "**/*"
ignore: []
---


# `{{ input }}.mdx`

```md
import { docco } from 'react-syntax-highlighter/styles/hljs'

export { swiss as theme } from "mdx-deck/themes";

## {{ input }}

---

## 自己紹介

---

- Jesse Katsumata
- CureApp

## ありがとうございました

```

