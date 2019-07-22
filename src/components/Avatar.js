import React from 'react'

const Avatar = () => (
  <img
    src={require('file-loader!../talks/assets/cat.jpg')}
    height="150"
    width="150"
    style={{ borderRadius: 75 }}
  />
)

export default Avatar
