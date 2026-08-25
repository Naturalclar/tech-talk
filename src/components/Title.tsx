import React from 'react'

// A heading parked in the slide's top-left corner rather than in its flow, so
// the rest of the slide keeps the whole area to itself.
const Title = ({
  color = 'inherit',
  label,
}: {
  color?: string
  label: string
}) => (
  <div style={{ left: 20, position: 'absolute', top: 20 }}>
    <h2 style={{ color }}>{label}</h2>
  </div>
)

export default Title
