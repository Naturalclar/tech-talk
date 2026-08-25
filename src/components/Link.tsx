import React, { type ReactNode } from 'react'

const Link = ({ children, href }: { children: ReactNode; href: string }) => (
  <a href={href} rel="noopener noreferrer" target="_blank">
    {children}
  </a>
)

export default Link
