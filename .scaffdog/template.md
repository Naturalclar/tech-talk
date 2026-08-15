---
name: 'new-slide'
root: './src/talks'
output: '.'
questions:
  slug: 'Enter the slug of your slide (lowercase, hyphen separated)'
  title: 'Enter the title of your slide'
  publishedAt: 'Enter the date you present it (YYYY-MM-DD)'
---

# `{{ inputs.slug }}/meta.json`

```json
{
  "title": "{{ inputs.title }}",
  "description": "{{ inputs.title }}",
  "slug": "{{ inputs.slug }}",
  "publishedAt": "{{ inputs.publishedAt }}"
}
```

# `{{ inputs.slug }}/slides.re.mdx`

````md
export { Themes } from '../../deck/Themes.tsx';

## {{ inputs.title }}

---

## 自己紹介

<img src="../assets/cat.jpg" height="250" />

- Jesse Katsumata アメリカ人 :flag-us:
- CureApp - React Native を使った治療アプリの開発
- Twitter: [@natural_clar](https://twitter.com/natural_clar) Github: [@Naturalclar](https://github.com/Naturalclar)

---

## 話すこと

---

## コードを見せる

```js {2}
const hello = () => console.log('hello')
hello()
```

---

## ありがとうございました
````
