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
import { CodeSurfer } from "mdx-deck-code-surfer"
export { swiss as theme } from "mdx-deck/themes";

## {{ input }}

---

## 自己紹介

<img src="/assets/cat.jpg" height="250" />

- Jesse Katsumata アメリカ人 :flag-us:
- CureApp - React Nativeを使った治療アプリの開発
- Twitter: [@natural_clar](https://twitter.com/natural_clar) Github: [@Naturalclar](https://github.com/Naturalclar)

---

## 話すこと

---

## ありがとうございました

```

