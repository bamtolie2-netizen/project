import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const { signInWithEmail, signUpWithEmail } = useAuth()
  const navigate = useNavigate()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, nickname)
      } else {
        await signInWithEmail(email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f4ff',padding:'20px'}}>
      <div style={{background:'white',borderRadius:'16px',padding:'32px',width:'100%',maxWidth:'380px',border:'0.5px solid #AFA9EC'}}>
        <div style={{textAlign:'center',marginBottom:'24px'}}>
          <div style={{fontSize:'40px',marginBottom:'8px'}}>🍼</div>
          <h1 style={{fontSize:'20px',fontWeight:'500',color:'#26215C',margin:0}}>체크리스트 앱</h1>
          <p style={{fontSize:'13px',color:'#534AB7',marginTop:'4px'}}>
            {isSignUp ? '계정을 만들어요' : '로그인하세요'}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {isSignUp && (
            <input
              type="text"
              placeholder="닉네임"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              required
              style={{padding:'10px 14px',borderRadius:'10px',border:'1px solid #AFA9EC',fontSize:'14px'}}
            />
          )}
          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{padding:'10px 14px',borderRadius:'10px',border:'1px solid #AFA9EC',fontSize:'14px'}}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{padding:'10px 14px',borderRadius:'10px',border:'1px solid #AFA9EC',fontSize:'14px'}}
          />
          {error && <p style={{color:'#D85A30',fontSize:'13px',margin:0}}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{padding:'11px',borderRadius:'10px',border:'none',background:'#534AB7',color:'white',fontSize:'14px',fontWeight:'500',cursor:'pointer'}}
          >
            {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
          </button>
        </form>

        <p style={{textAlign:'center',fontSize:'13px',color:'#534AB7',marginTop:'16px',cursor:'pointer'}}
           onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? '이미 계정이 있어요 → 로그인' : '계정이 없어요 → 회원가입'}
        </p>
      </div>
    </div>
  )
}