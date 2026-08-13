---
name: 'new-slide'
root: './src/talks'
output: '.'
questions:
  slug: 'Enter the slug of your slide (lowercase, hyphen separated)'
  title: 'Enter the title of your slide'
  publishedAt: 'Enter the date you present it (YYYY-MM-DD)'
---

# `{{ inputs.slug }}/index.mdx`

```md
import { docco } from 'react-syntax-highlighter/styles/hljs'
import { CodeSurfer } from "mdx-deck-code-surfer"
import { Head } from 'mdx-deck'
import { Meta } from '../../components'
export { swiss as theme } from "mdx-deck/themes";

<Head>
  <Meta
    title="{{ inputs.title }}"
    description="{{ inputs.title }}"
    slug="{{ inputs.slug }}"
    publishedAt={new Date("{{ inputs.publishedAt }}")}
  />
</Head>

## {{ inputs.title }}

---

## 自己紹介

<img src={require('file-loader!../assets/cat.jpg')} height="250" />

- Jesse Katsumata アメリカ人 :flag-us:
- CureApp - React Native を使った治療アプリの開発
- Twitter: [@natural_clar](https://twitter.com/natural_clar) Github: [@Naturalclar](https://github.com/Naturalclar)

---

## 話すこと

---

## ありがとうございました
```
