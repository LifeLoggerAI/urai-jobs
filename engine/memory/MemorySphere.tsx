"use client"

import * as THREE from "three"
import { useRef } from "react"
import { useFrame } from "@react-three/fiber"

export default function MemorySphere() {
  const ref = useRef<THREE.Mesh>(null!)

  useFrame(() => {
    if (!ref.current) return
    ref.current.rotation.y += 0.01
  })

  return (
    <mesh ref={ref} position={[0, 0, -50]}>
      <sphereGeometry args={[20, 32, 32]} />
      <meshBasicMaterial color="white" wireframe />
    </mesh>
  )
}
