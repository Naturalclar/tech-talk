import React, {useState} from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

type Props = {
  foo: string,
  bar: string
}

const HelloComponent = ({foo, bar}: Props ) => {
  const [fizz, setFizz] = useState('buzz')

  return (
    <View>
      <Text>{fizz}</Text>
      <TouchableOpacity onPress={handlePress} >
        <Text>Click Me!</Text>
      </TouchableOpacity/>
    </View>
  )
}