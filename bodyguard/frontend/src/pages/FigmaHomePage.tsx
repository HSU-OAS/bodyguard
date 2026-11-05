// FR-S-06/FR-V-03: local visual review only; no candidate is presented as approved coaching.
import { useState } from 'react'
import { Link } from 'react-router'
import rightIcon from '../assets/figma-home/2b203.svg'
import analysisIcon from '../assets/figma-home/7cba9.svg'
import recordsIcon from '../assets/figma-home/38cc0.svg'
import leftIcon from '../assets/figma-home/638be.svg'
import accountIcon from '../assets/figma-home/a7dcb.svg'
import changesIcon from '../assets/figma-home/b943c.svg'
import favoritesIcon from '../assets/figma-home/ec753.svg'
import routineIcon from '../assets/figma-home/f2c6a.svg'
import { motionPreviewMedia } from '../catalog/motionMedia'
import { MotionPreview } from './MotionPreview'
import './FigmaHomePage.css'

const items = [
  { name: '목 옆 늘리기', id: 'neck-side' },
  { name: '턱 당기기', id: 'chin-retraction' },
  { name: '어깨 올리기', id: 'shoulder-shrug' },
  { name: '양팔 교차하기', id: 'cross-body-shoulder' },
  { name: '어깨 가로 늘리기' },
  { name: '팔 위로 늘리기', id: 'arm-overhead' },
  { name: '기지개 켜기' },
  { name: '옆구리 늘리기', id: 'lateral-trunk' },
  { name: '몸통 돌리기', id: 'seated-trunk-rotation' },
] as const

export function FigmaHomePage() {
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [selected, setSelected] = useState<string>()
  return (
    <main className="figma-home">
      <header className="figma-header">
        <Link to="/" className="figma-wordmark">
          BODYGUARD
        </Link>
        <Link to="/account" className="figma-account">
          내 계정 <img src={accountIcon} alt="" />
        </Link>
      </header>
      <h1 className="figma-notice">화면 검수용 · 아바타와 동작은 검증 중입니다</h1>
      <div className="figma-stage" role="img" aria-label="Figma에 사용된 아바타 정지 시안" />
      <aside
        className={`figma-drawer figma-left${leftOpen ? '' : ' is-collapsed'}`}
        aria-label="서비스 메뉴"
      >
        <button
          className="figma-toggle"
          type="button"
          onClick={() => setLeftOpen(!leftOpen)}
          aria-expanded={leftOpen}
          aria-label={`서비스 메뉴 ${leftOpen ? '접기' : '펼치기'}`}
        >
          <img src={leftIcon} alt="" />
        </button>
        {leftOpen && (
          <nav className="figma-nav" aria-label="서비스 메뉴">
            <button type="button" disabled>
              <img src={analysisIcon} alt="" />
              AI 신체 분석 <small>준비 중</small>
            </button>
            <button type="button" disabled>
              <img src={routineIcon} alt="" />
              맞춤 루틴 <small>준비 중</small>
            </button>
            <Link to="/records">
              <img src={recordsIcon} alt="" />
              스트레칭 기록
            </Link>
            <button type="button" disabled>
              <img src={changesIcon} alt="" />
              변화 보기 <small>준비 중</small>
            </button>
            <button type="button" disabled>
              <img src={favoritesIcon} alt="" />
              즐겨찾기 <small>준비 중</small>
            </button>
          </nav>
        )}
      </aside>
      <aside
        className={`figma-drawer figma-right${rightOpen ? '' : ' is-collapsed'}`}
        aria-label="스트레칭 선택"
      >
        <button
          className="figma-toggle"
          type="button"
          onClick={() => setRightOpen(!rightOpen)}
          aria-expanded={rightOpen}
          aria-label={`동작 목록 ${rightOpen ? '접기' : '펼치기'}`}
        >
          <img src={rightIcon} alt="" />
        </button>
        {rightOpen && (
          <>
            <div className="figma-motions">
              {items.map((item, index) => {
                const id = 'id' in item ? item.id : undefined
                const media = id ? motionPreviewMedia(id) : undefined
                return (
                  <div
                    className={`figma-motion${selected === id && id ? ' is-selected' : ''}`}
                    key={item.name}
                    onPointerDown={() => {
                      if (id) setSelected(id)
                    }}
                  >
                    {media ? (
                      <MotionPreview title={item.name} media={media} />
                    ) : (
                      <div
                        className={`figma-thumb figma-thumb-${index}`}
                        role="img"
                        aria-label={`${item.name} 정지 시안`}
                      />
                    )}
                    <button
                      type="button"
                      disabled={!id}
                      aria-pressed={!!id && selected === id}
                      onClick={() => setSelected(id)}
                    >
                      {item.name}
                      {!id && <small>준비 중</small>}
                    </button>
                  </div>
                )
              })}
            </div>
            {selected ? (
              <Link
                className="figma-start"
                to={`/dev/coaching?motion=${encodeURIComponent(selected)}`}
              >
                코칭 화면 보기
              </Link>
            ) : (
              <button className="figma-start" type="button" disabled>
                동작을 선택해 주세요
              </button>
            )}
          </>
        )}
      </aside>
    </main>
  )
}
