import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const COLORS = ['#534AB7','#1D9E75','#D4537E','#BA7517','#D85A30','#378ADD']
const PRI_LABEL = { urgent:'긴급', soon:'곧', ok:'여유' }
const PRI_COLOR = { urgent:'#FAECE7', soon:'#FAEEDA', ok:'#EAF3DE' }
const PRI_TEXT = { urgent:'#712B13', soon:'#633806', ok:'#27500A' }

export default function HomePage() {
  const { user, signOut } = useAuth()
  const [project, setProject] = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState({})
  const [tab, setTab] = useState('home')
  const [activeCat, setActiveCat] = useState(null)
  const [modal, setModal] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [editItemCat, setEditItemCat] = useState(null)
  const [settingsTab, setSettingsTab] = useState('project')
  const [settingsCat, setSettingsCat] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (user) initProject() }, [user])

  async function initProject() {
    let { data: proj } = await supabase.from('projects').select('*').eq('user_id', user.id).single()
    if (!proj) {
      const { data } = await supabase.from('projects').insert({
        user_id: user.id, title: '또담이를 기다리며', emoji: '🍼',
        color: '#534AB7', due_date: '2026-05-22', due_label: '출산 예정일'
      }).select().single()
      proj = data
      await supabase.from('categories').insert([
        { project_id: proj.id, name: '육아용품', emoji: '🛍️', color: '#534AB7', sort_order: 0 },
        { project_id: proj.id, name: '병원·건강', emoji: '🏥', color: '#1D9E75', sort_order: 1 },
        { project_id: proj.id, name: '공간·방', emoji: '🏠', color: '#D4537E', sort_order: 2 },
        { project_id: proj.id, name: '서류·행정', emoji: '📋', color: '#BA7517', sort_order: 3 },
        { project_id: proj.id, name: '음식·영양', emoji: '🥗', color: '#D85A30', sort_order: 4 },
      ])
    }
    setProject(proj)
    await loadCategories(proj.id)
    setLoading(false)
  }

  async function loadCategories(projectId) {
    const pid = projectId || project?.id
    const { data: cats } = await supabase.from('categories').select('*').eq('project_id', pid).order('sort_order')
    setCategories(cats || [])
    const allItems = {}
    for (const cat of (cats || [])) {
      const { data } = await supabase.from('checklist_items').select('*, item_urls(*)').eq('category_id', cat.id).order('sort_order')
      allItems[cat.id] = data || []
    }
    setItems(allItems)
  }

  function getDday() {
    if (!project?.due_date) return ''
    const due = new Date(project.due_date)
    const today = new Date(); today.setHours(0,0,0,0)
    const d = Math.ceil((due - today) / 86400000)
    return d > 0 ? `D-${d}` : d === 0 ? 'D-day' : `D+${Math.abs(d)}`
  }

  function getTotal() {
    let done = 0, total = 0
    categories.forEach(c => {
      const arr = items[c.id] || []
      done += arr.filter(i => i.is_done).length
      total += arr.length
    })
    return { done, total }
  }

  async function toggleItem(itemId, catId, isDone) {
    await supabase.from('checklist_items').update({ is_done: !isDone }).eq('id', itemId)
    setItems(prev => ({
      ...prev,
      [catId]: prev[catId].map(i => i.id === itemId ? { ...i, is_done: !isDone } : i)
    }))
  }

  async function saveItemModal() {
    const name = document.getElementById('m_name')?.value?.trim()
    if (!name) return
    const priority = document.getElementById('m_pri')?.value
    const memo = document.getElementById('m_memo')?.value?.trim()
    const urlInputs = document.querySelectorAll('.url-input')
    const urls = Array.from(urlInputs).map(i => i.value.trim()).filter(Boolean)

    if (modal === 'edit' && editItem) {
      await supabase.from('checklist_items').update({ name, priority, memo }).eq('id', editItem.id)
      await supabase.from('item_urls').delete().eq('item_id', editItem.id)
      if (urls.length) await supabase.from('item_urls').insert(urls.map((url, i) => ({ item_id: editItem.id, url, sort_order: i })))
    } else {
      const catId = activeCat || settingsCat
      const { data: newItem } = await supabase.from('checklist_items')
        .insert({ category_id: catId, name, priority, memo, sort_order: (items[catId]?.length || 0) })
        .select().single()
      if (urls.length && newItem) await supabase.from('item_urls').insert(urls.map((url, i) => ({ item_id: newItem.id, url, sort_order: i })))
    }
    await loadCategories()
    setModal(null); setEditItem(null); setEditItemCat(null)
  }

  async function deleteItem() {
    if (!editItem) return
    await supabase.from('checklist_items').delete().eq('id', editItem.id)
    await loadCategories()
    setModal(null); setEditItem(null); setEditItemCat(null)
  }

  async function saveProject() {
    const title = document.getElementById('s_title')?.value
    const emoji = document.getElementById('s_emoji')?.value
    const dueDate = document.getElementById('s_due')?.value
    const dueLabel = document.getElementById('s_duelabel')?.value
    await supabase.from('projects').update({ title, emoji, due_date: dueDate, due_label: dueLabel }).eq('id', project.id)
    setProject(prev => ({ ...prev, title, emoji, due_date: dueDate, due_label: dueLabel }))
    alert('저장됐어요!')
  }

  async function addCategory() {
    const { data } = await supabase.from('categories').insert({
      project_id: project.id, name: '새 카테고리', emoji: '📌', color: '#534AB7', sort_order: categories.length
    }).select().single()
    await loadCategories()
    setSettingsCat(data.id)
  }

  async function updateCategory(id, field, value) {
    await supabase.from('categories').update({ [field]: value }).eq('id', id)
    setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  async function deleteCategory(id) {
    if (!confirm('카테고리와 모든 항목이 삭제돼요. 계속할까요?')) return
    await supabase.from('categories').delete().eq('id', id)
    await loadCategories()
  }

  async function moveCategory(id, dir) {
    const idx = categories.findIndex(c => c.id === id)
    const j = idx + dir
    if (j < 0 || j >= categories.length) return
    const updated = [...categories]
    ;[updated[idx], updated[j]] = [updated[j], updated[idx]]
    setCategories(updated)
    await Promise.all(updated.map((c, i) => supabase.from('categories').update({ sort_order: i }).eq('id', c.id)))
  }

  async function moveItem(catId, itemId, dir) {
    const arr = [...(items[catId] || [])]
    const i = arr.findIndex(x => x.id === itemId)
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setItems(prev => ({ ...prev, [catId]: arr }))
    await Promise.all(arr.map((item, idx) => supabase.from('checklist_items').update({ sort_order: idx }).eq('id', item.id)))
  }

  async function updateItemField(catId, itemId, field, value) {
    await supabase.from('checklist_items').update({ [field]: value }).eq('id', itemId)
    setItems(prev => ({ ...prev, [catId]: prev[catId].map(i => i.id === itemId ? { ...i, [field]: value } : i) }))
  }

  async function deleteItemSettings(catId, itemId) {
    await supabase.from('checklist_items').delete().eq('id', itemId)
    setItems(prev => ({ ...prev, [catId]: prev[catId].filter(i => i.id !== itemId) }))
  }

  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#534AB7',fontSize:'14px'}}>불러오는 중...</div>

  const { done, total } = getTotal()
  const pct = total ? Math.round(done / total * 100) : 0
  const c = project?.color || '#534AB7'

  // 모달
  if (modal) {
    const isEdit = modal === 'edit'
    const item = isEdit ? editItem : { name: '', priority: 'soon', memo: '', item_urls: [] }
    const urls = item?.item_urls?.length ? item.item_urls : [{ url: '' }]
    return (
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'center',background:'rgba(0,0,0,0.35)',minHeight:'100vh',padding:'20px'}}>
        <div style={{background:'white',borderRadius:'16px',padding:'20px',width:'100%',maxWidth:'420px',marginTop:'20px',border:'0.5px solid #AFA9EC'}}>
          <div style={{fontSize:'15px',fontWeight:'500',marginBottom:'14px'}}>{isEdit ? '항목 수정' : '새 항목'}</div>
          <div style={{marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:'#888',marginBottom:'4px'}}>이름</div>
            <input id="m_name" defaultValue={item.name} placeholder="항목 이름" style={{width:'100%',padding:'8px 10px',borderRadius:'8px',border:'1px solid #AFA9EC',fontSize:'13px',boxSizing:'border-box'}}/>
          </div>
          <div style={{marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:'#888',marginBottom:'4px'}}>우선순위</div>
            <select id="m_pri" defaultValue={item.priority} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'1px solid #AFA9EC',fontSize:'13px'}}>
              <option value="urgent">긴급</option>
              <option value="soon">곧</option>
              <option value="ok">여유</option>
            </select>
          </div>
          <div style={{marginBottom:'10px'}}>
            <div style={{fontSize:'11px',color:'#888',marginBottom:'4px'}}>제품 링크</div>
            <div id="urlList">
              {urls.map((u, i) => (
                <div key={i} style={{display:'flex',gap:'6px',marginBottom:'6px'}}>
                  <input className="url-input" defaultValue={u.url} placeholder="https://..." style={{flex:1,padding:'7px 10px',borderRadius:'8px',border:'1px solid #AFA9EC',fontSize:'13px'}}/>
                </div>
              ))}
            </div>
            <button onClick={() => {
              const div = document.createElement('div')
              div.style.cssText = 'display:flex;gap:6px;margin-bottom:6px'
              div.innerHTML = '<input class="url-input" placeholder="https://..." style="flex:1;padding:7px 10px;border-radius:8px;border:1px solid #AFA9EC;font-size:13px"/>'
              document.getElementById('urlList').appendChild(div)
            }} style={{fontSize:'12px',color:'#534AB7',background:'#EEEDFE',border:'0.5px solid #AFA9EC',borderRadius:'8px',padding:'4px 10px',cursor:'pointer'}}>+ 링크 추가</button>
          </div>
          <div style={{marginBottom:'12px'}}>
            <div style={{fontSize:'11px',color:'#888',marginBottom:'4px'}}>메모</div>
            <textarea id="m_memo" defaultValue={item.memo} placeholder="가격 비교, 메모..." style={{width:'100%',padding:'8px 10px',borderRadius:'8px',border:'1px solid #AFA9EC',fontSize:'13px',minHeight:'56px',resize:'vertical',boxSizing:'border-box'}}/>
          </div>
          <div style={{display:'flex',gap:'7px',justifyContent:'flex-end'}}>
            {isEdit && <button onClick={deleteItem} style={{padding:'7px 13px',borderRadius:'8px',border:'1px solid #F0997B',background:'white',color:'#D85A30',fontSize:'13px',cursor:'pointer'}}>삭제</button>}
            <button onClick={() => { setModal(null); setEditItem(null) }} style={{padding:'7px 13px',borderRadius:'8px',border:'1px solid #ddd',background:'white',color:'#888',fontSize:'13px',cursor:'pointer'}}>취소</button>
            <button onClick={saveItemModal} style={{padding:'7px 16px',borderRadius:'8px',border:'none',background:'#534AB7',color:'white',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>저장</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{maxWidth:'480px',margin:'0 auto',minHeight:'100vh',background:'#f8f7ff',display:'flex',flexDirection:'column'}}>
      {/* 헤더 */}
      <div style={{background:`${c}18`,padding:'14px 16px',borderBottom:`0.5px solid ${c}44`}}>
        {tab === 'settings' ? (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:'17px',fontWeight:'500',color:c}}>⚙️ 설정</div>
            <button onClick={signOut} style={{fontSize:'12px',color:'#888',background:'white',border:'0.5px solid #ddd',borderRadius:'8px',padding:'4px 10px',cursor:'pointer'}}>로그아웃</button>
          </div>
        ) : activeCat ? (
          <div>
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
              <button onClick={() => setActiveCat(null)} style={{fontSize:'12px',background:'white',border:'0.5px solid #ddd',borderRadius:'8px',padding:'5px 10px',cursor:'pointer',color:'#888'}}>← 뒤로</button>
              <div style={{fontSize:'17px',fontWeight:'500',color:c}}>{categories.find(c=>c.id===activeCat)?.emoji} {categories.find(c=>c.id===activeCat)?.name}</div>
            </div>
            <div style={{background:`${c}28`,borderRadius:'20px',height:'6px'}}>
              <div style={{background:c,borderRadius:'20px',height:'6px',width:`${(items[activeCat]||[]).length ? Math.round((items[activeCat]||[]).filter(i=>i.is_done).length/(items[activeCat]||[]).length*100) : 0}%`,transition:'width .4s'}}/>
            </div>
          </div>
        ) : (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div>
                <div style={{fontSize:'17px',fontWeight:'500',color:`${c}cc`}}>{project?.emoji} {project?.title}</div>
                <div style={{fontSize:'12px',color:`${c}99`,marginTop:'2px'}}>{project?.due_label}</div>
              </div>
              <div style={{background:c,color:'white',fontSize:'12px',fontWeight:'500',padding:'4px 10px',borderRadius:'20px'}}>{getDday()}</div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
              <span style={{fontSize:'11px',color:`${c}99`}}>전체 준비율 {pct}%</span>
              <span style={{fontSize:'11px',color:`${c}99`}}>{done}/{total}</span>
            </div>
            <div style={{background:`${c}28`,borderRadius:'20px',height:'6px'}}>
              <div style={{background:c,borderRadius:'20px',height:'6px',width:`${pct}%`,transition:'width .4s'}}/>
            </div>
          </div>
        )}
      </div>

      {/* 바디 */}
      <div style={{flex:1,padding:'12px 14px',display:'flex',flexDirection:'column',gap:'10px',overflowY:'auto'}}>
        {tab === 'home' && !activeCat && (
          <>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px'}}>
              {categories.map(cat => {
                const arr = items[cat.id] || []
                const d = arr.filter(i => i.is_done).length
                const p = arr.length ? Math.round(d/arr.length*100) : 0
                return (
                  <div key={cat.id} onClick={() => setActiveCat(cat.id)} style={{background:'white',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'10px 8px',textAlign:'center',cursor:'pointer'}}>
                    <div style={{fontSize:'22px'}}>{cat.emoji}</div>
                    <div style={{fontSize:'14px',fontWeight:'500',marginTop:'2px'}}>{d}/{arr.length}</div>
                    <div style={{fontSize:'11px',color:'#888',marginTop:'2px'}}>{cat.name}</div>
                    <div style={{background:'#f0f0f0',borderRadius:'10px',height:'3px',marginTop:'5px'}}>
                      <div style={{background:cat.color,borderRadius:'10px',height:'3px',width:`${p}%`}}/>
                    </div>
                  </div>
                )
              })}
            </div>
            {categories.flatMap(cat => (items[cat.id]||[]).filter(i=>!i.is_done&&i.priority==='urgent').map(i=>({...i,_cat:cat}))).slice(0,4).length > 0 && (
              <>
                <div style={{fontSize:'13px',fontWeight:'500',color:'#333'}}>긴급 항목</div>
                {categories.flatMap(cat => (items[cat.id]||[]).filter(i=>!i.is_done&&i.priority==='urgent').map(i=>({...i,_cat:cat}))).slice(0,4).map(item => (
                  <ItemCard key={item.id} item={item} cat={item._cat} onToggle={toggleItem} onEdit={(i,c)=>{setEditItem(i);setEditItemCat(c);setModal('edit')}}/>
                ))}
              </>
            )}
          </>
        )}

        {tab === 'home' && activeCat && (
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'13px',fontWeight:'500'}}>항목</span>
              <button onClick={()=>setModal('add')} style={{fontSize:'12px',padding:'4px 10px',borderRadius:'8px',border:'0.5px solid #AFA9EC',background:'#EEEDFE',color:'#3C3489',cursor:'pointer'}}>+ 추가</button>
            </div>
            {!(items[activeCat]||[]).length && <div style={{textAlign:'center',padding:'28px',color:'#aaa',fontSize:'13px'}}>항목이 없어요<br/>+ 추가 버튼으로 만들어보세요</div>}
            {['urgent','soon','ok'].flatMap(pri => (items[activeCat]||[]).filter(i=>i.priority===pri).map(item => (
              <ItemCard key={item.id} item={item} cat={categories.find(c=>c.id===activeCat)} onToggle={toggleItem} onEdit={(i,c)=>{setEditItem(i);setEditItemCat(c);setModal('edit')}}/>
            )))}
          </>
        )}

        {tab === 'settings' && (
          <Settings
            project={project} categories={categories} items={items}
            settingsTab={settingsTab} setSettingsTab={setSettingsTab}
            settingsCat={settingsCat} setSettingsCat={setSettingsCat}
            saveProject={saveProject} addCategory={addCategory}
            updateCategory={updateCategory} deleteCategory={deleteCategory}
            moveCategory={moveCategory} moveItem={moveItem}
            updateItemField={updateItemField} deleteItemSettings={deleteItemSettings}
            openAddItem={(catId)=>{setSettingsCat(catId);setModal('add')}}
            openEditItem={(item,catId)=>{setEditItem(item);setEditItemCat(catId);setModal('edit')}}
            COLORS={COLORS}
          />
        )}
      </div>

      {/* 하단 네비 */}
      <div style={{display:'flex',borderTop:'0.5px solid #e0e0e0',background:'white'}}>
        {[['home','🏠','홈'],['settings','⚙️','설정']].map(([t,icon,label])=>(
          <button key={t} onClick={()=>{setTab(t);setActiveCat(null)}} style={{flex:1,padding:'10px 0',border:'none',background:'none',cursor:'pointer',fontSize:'11px',color:tab===t?c:'#aaa',display:'flex',flexDirection:'column',alignItems:'center',gap:'3px'}}>
            <span style={{fontSize:'18px'}}>{icon}</span>{label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ItemCard({ item, cat, onToggle, onEdit }) {
  const urlCount = (item.item_urls||[]).length
  return (
    <div onClick={()=>onEdit(item, cat?.id)} style={{background:'white',border:'0.5px solid #e0e0e0',borderRadius:'12px',padding:'10px 12px',cursor:'pointer'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
        <div onClick={e=>{e.stopPropagation();onToggle(item.id,item.category_id,item.is_done)}}
          style={{width:'20px',height:'20px',borderRadius:'6px',flexShrink:0,border:item.is_done?'none':'1.5px solid #AFA9EC',background:item.is_done?'#534AB7':'white',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          {item.is_done && <span style={{color:'white',fontSize:'12px'}}>✓</span>}
        </div>
        <span style={{flex:1,fontSize:'13px',color:item.is_done?'#aaa':'#333',textDecoration:item.is_done?'line-through':'none'}}>{item.name}</span>
        <span style={{fontSize:'10px',padding:'2px 7px',borderRadius:'20px',background:PRI_COLOR[item.priority],color:PRI_TEXT[item.priority]}}>{PRI_LABEL[item.priority]}</span>
      </div>
      {(item.memo || urlCount > 0) && (
        <div style={{display:'flex',gap:'5px',marginTop:'5px',marginLeft:'30px'}}>
          {item.memo && <span style={{fontSize:'11px',color:'#534AB7',background:'#EEEDFE',padding:'2px 7px',borderRadius:'10px'}}>📝 메모</span>}
          {urlCount > 0 && <span style={{fontSize:'11px',color:'#534AB7',background:'#EEEDFE',padding:'2px 7px',borderRadius:'10px'}}>🔗 {urlCount}개</span>}
        </div>
      )}
    </div>
  )
}

function Settings({ project, categories, items, settingsTab, setSettingsTab, settingsCat, setSettingsCat, saveProject, addCategory, updateCategory, deleteCategory, moveCategory, moveItem, updateItemField, deleteItemSettings, openAddItem, openEditItem, COLORS }) {
  const selCat = settingsCat || categories[0]?.id
  const catItems = items[selCat] || []

  return (
    <>
      <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
        {[['project','프로젝트'],['categories','카테고리'],['items','항목']].map(([t,l])=>(
          <button key={t} onClick={()=>setSettingsTab(t)} style={{padding:'6px 12px',borderRadius:'8px',border:'0.5px solid',borderColor:settingsTab===t?'#AFA9EC':'#e0e0e0',background:settingsTab===t?'#EEEDFE':'white',color:settingsTab===t?'#3C3489':'#888',fontSize:'12px',fontWeight:settingsTab===t?'500':'400',cursor:'pointer'}}>{l}</button>
        ))}
      </div>

      {settingsTab === 'project' && (
        <div style={{background:'white',border:'0.5px solid #e0e0e0',borderRadius:'12px',overflow:'hidden'}}>
          {[
            ['이모지','s_emoji','text',project?.emoji,2],
            ['프로젝트 제목','s_title','text',project?.title,null],
            ['D-day 레이블','s_duelabel','text',project?.due_label,null],
            ['목표 날짜','s_due','date',project?.due_date,null],
          ].map(([label,id,type,val,max],i)=>(
            <div key={id} style={{padding:'12px 14px',borderBottom:i<3?'0.5px solid #f0f0f0':'none'}}>
              <div style={{fontSize:'11px',color:'#888',marginBottom:'4px'}}>{label}</div>
              <input id={id} type={type} defaultValue={val||''} maxLength={max||undefined} style={{width:'100%',border:'0.5px solid #e0e0e0',borderRadius:'8px',padding:'7px 10px',fontSize:'13px',boxSizing:'border-box'}}/>
            </div>
          ))}
          <div style={{padding:'12px 14px'}}>
            <button onClick={saveProject} style={{width:'100%',padding:'9px',borderRadius:'8px',border:'none',background:'#534AB7',color:'white',fontSize:'13px',fontWeight:'500',cursor:'pointer'}}>저장</button>
          </div>
        </div>
      )}

      {settingsTab === 'categories' && (
        <>
          <div style={{background:'white',border:'0.5px solid #e0e0e0',borderRadius:'12px',overflow:'hidden'}}>
            {categories.map((cat,i)=>(
              <div key={cat.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'10px 12px',borderBottom:i<categories.length-1?'0.5px solid #f0f0f0':'none'}}>
                <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                  <button onClick={()=>moveCategory(cat.id,-1)} disabled={i===0} style={{fontSize:'10px',padding:'1px 5px',border:'0.5px solid #e0e0e0',borderRadius:'4px',background:'#f8f8f8',cursor:'pointer',color:'#888'}}>▲</button>
                  <button onClick={()=>moveCategory(cat.id,1)} disabled={i===categories.length-1} style={{fontSize:'10px',padding:'1px 5px',border:'0.5px solid #e0e0e0',borderRadius:'4px',background:'#f8f8f8',cursor:'pointer',color:'#888'}}>▼</button>
                </div>
                <input defaultValue={cat.emoji} maxLength={2} onBlur={e=>updateCategory(cat.id,'emoji',e.target.value)} style={{width:'36px',textAlign:'center',border:'0.5px solid #e0e0e0',borderRadius:'8px',padding:'5px',fontSize:'16px'}}/>
                <input defaultValue={cat.name} onBlur={e=>updateCategory(cat.id,'name',e.target.value)} style={{flex:1,border:'0.5px solid #e0e0e0',borderRadius:'8px',padding:'6px 8px',fontSize:'13px'}}/>
                <div style={{display:'flex',gap:'4px',flexWrap:'wrap',width:'52px'}}>
                  {COLORS.map(col=>(
                    <div key={col} onClick={()=>updateCategory(cat.id,'color',col)} style={{width:'14px',height:'14px',borderRadius:'50%',background:col,cursor:'pointer',border:cat.color===col?'2px solid #333':'2px solid transparent'}}/>
                  ))}
                </div>
                <button onClick={()=>deleteCategory(cat.id)} style={{background:'#FAECE7',color:'#712B13',border:'0.5px solid #F0997B',borderRadius:'8px',padding:'5px 8px',cursor:'pointer',fontSize:'12px'}}>✕</button>
              </div>
            ))}
          </div>
          <button onClick={addCategory} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #AFA9EC',background:'#EEEDFE',color:'#3C3489',fontSize:'12px',cursor:'pointer'}}>+ 카테고리 추가</button>
        </>
      )}

      {settingsTab === 'items' && (
        <>
          <div style={{display:'flex',gap:'6px',overflowX:'auto',paddingBottom:'2px'}}>
            {categories.map(cat=>(
              <button key={cat.id} onClick={()=>setSettingsCat(cat.id)} style={{padding:'5px 10px',borderRadius:'8px 8px 0 0',border:'0.5px solid',borderColor:(selCat===cat.id)?'#AFA9EC':'#e0e0e0',background:(selCat===cat.id)?'white':'#f8f8f8',color:(selCat===cat.id)?'#534AB7':'#888',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'}}>
                {cat.emoji} {cat.name}
              </button>
            ))}
          </div>
          <div style={{background:'white',border:'0.5px solid #e0e0e0',borderRadius:'12px',overflow:'hidden'}}>
            {!catItems.length && <div style={{padding:'16px',textAlign:'center',color:'#aaa',fontSize:'13px'}}>항목이 없어요</div>}
            {catItems.map((item,i)=>(
              <div key={item.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'9px 12px',borderBottom:i<catItems.length-1?'0.5px solid #f0f0f0':'none'}}>
                <div style={{display:'flex',flexDirection:'column',gap:'2px'}}>
                  <button onClick={()=>moveItem(selCat,item.id,-1)} disabled={i===0} style={{fontSize:'10px',padding:'1px 5px',border:'0.5px solid #e0e0e0',borderRadius:'4px',background:'#f8f8f8',cursor:'pointer',color:'#888'}}>▲</button>
                  <button onClick={()=>moveItem(selCat,item.id,1)} disabled={i===catItems.length-1} style={{fontSize:'10px',padding:'1px 5px',border:'0.5px solid #e0e0e0',borderRadius:'4px',background:'#f8f8f8',cursor:'pointer',color:'#888'}}>▼</button>
                </div>
                <input defaultValue={item.name} onBlur={e=>updateItemField(selCat,item.id,'name',e.target.value)} style={{flex:1,border:'0.5px solid #e0e0e0',borderRadius:'8px',padding:'6px 8px',fontSize:'13px'}}/>
                <select defaultValue={item.priority} onChange={e=>updateItemField(selCat,item.id,'priority',e.target.value)} style={{border:'0.5px solid #e0e0e0',borderRadius:'8px',padding:'5px 6px',fontSize:'12px'}}>
                  <option value="urgent">긴급</option>
                  <option value="soon">곧</option>
                  <option value="ok">여유</option>
                </select>
                <button onClick={()=>deleteItemSettings(selCat,item.id)} style={{background:'#FAECE7',color:'#712B13',border:'0.5px solid #F0997B',borderRadius:'8px',padding:'5px 8px',cursor:'pointer',fontSize:'12px'}}>✕</button>
              </div>
            ))}
          </div>
          <button onClick={()=>openAddItem(selCat)} style={{width:'100%',padding:'8px',borderRadius:'8px',border:'0.5px solid #AFA9EC',background:'#EEEDFE',color:'#3C3489',fontSize:'12px',cursor:'pointer'}}>+ 항목 추가</button>
        </>
      )}
    </>
  )
}