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

## Jesse Katsumata
- CureApp
- React Nativeを使った治療アプリの開発
- アメリカ人 :flag-us:
- Twitter: [@natural_clar](https://twitter.com/natural_clar)
- Github: [@Naturalclar](https://github.com/Naturalclar)

---

## ありがとうございました

```

