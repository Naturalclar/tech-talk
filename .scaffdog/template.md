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
import { Profile } from '../../components';
export { Themes } from '../../deck/Themes.tsx';

## {{ inputs.title }}

---

## 自己紹介

<Profile />

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
