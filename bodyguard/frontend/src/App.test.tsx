// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { App } from './App'

// happy-dom에는 WebGL이 없어서 3D 화면은 빼고 확인한다
vi.mock('./avatar/Skeleton3D', () => ({ Skeleton3D: () => null }))

it('접속만으로는 카메라를 켜지 않고 시작 버튼을 보여준다', () => {
  render(<App />)
  expect(screen.getByRole('button', { name: '측정 시작' })).toBeTruthy()
  expect(screen.queryByTestId('measuring-badge')).toBeNull()
  expect(screen.getByText(/영상은 이 브라우저 밖으로 나가지 않고/)).toBeTruthy()
})
