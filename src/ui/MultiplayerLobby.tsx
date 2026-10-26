import { useEffect, useState, type FormEvent } from 'react';
import { Copy, Crown, LoaderCircle, Users } from 'lucide-react';
import { getHeroCharacter } from '../game/characterCatalog';
import type { RoomState } from '../game/RoomClient';

export function MultiplayerLobby({ room, onJoin, onCreate, onOffline }: { room: RoomState; onJoin: (pin: string) => void; onCreate: () => void; onOffline: () => void }) {
  const [joinPin, setJoinPin] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  useEffect(() => { setCopyMessage(''); }, [room.pin]);
  const join = (event: FormEvent) => { event.preventDefault(); const pin = joinPin.trim().toUpperCase(); if (pin) onJoin(pin); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(room.pin); setCopyMessage('Đã sao chép mã phòng.'); }
    catch { setCopyMessage('Chọn mã phòng ở trên để sao chép thủ công.'); }
  };
  if (room.status === 'offline') return <div className="multiplayer-lobby solo-lobby"><span>Chơi một mình</span><button className="text-button" onClick={onCreate}><Users size={15} /> Tạo phòng cùng bạn</button></div>;
  return <section className="multiplayer-lobby" aria-label="Phòng chơi cùng bạn">
    <div className="lobby-heading"><h2><Users size={18} /> Chơi cùng bạn</h2><span>{room.players.length}/4</span></div>
    {room.pin && <div className="lobby-code"><label htmlFor="room-pin">Mã phòng</label><input id="room-pin" value={room.pin} readOnly onFocus={event => event.currentTarget.select()} aria-label="Mã phòng để mời bạn" /><button className="icon-button" onClick={() => void copy()} aria-label="Sao chép mã phòng"><Copy size={17} /></button></div>}
    {room.status === 'connecting' ? <p className="lobby-connection" role="status"><LoaderCircle size={16} /> Đang mở phòng…</p> : <ul className="lobby-roster">{room.players.map(player => <li key={player.id} className={player.id === room.selfId ? 'is-self' : ''}><img src={getHeroCharacter(player.heroId).portrait} alt="" /><div><strong>{player.id === room.selfId ? 'Bạn' : player.name || 'Đồng đội'}{player.id === room.hostId && <Crown size={12} aria-label="Chủ phòng" />}</strong><span>{getHeroCharacter(player.heroId).label}{!player.connected && ' · Mất kết nối'}</span></div></li>)}</ul>}
    <form className="lobby-join" onSubmit={join}><label className="sr-only" htmlFor="join-room-pin">Mã phòng của bạn bè</label><input id="join-room-pin" value={joinPin} onChange={event => setJoinPin(event.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="off" inputMode="numeric" pattern="[0-9]{6}" spellCheck={false} placeholder="Mã 6 số của bạn bè" maxLength={6} /><button className="button secondary" disabled={joinPin.length !== 6 || room.status === 'connecting'} type="submit">Vào phòng</button></form>
    {(room.error || copyMessage) && <p className="lobby-feedback" role="status">{room.error || copyMessage}</p>}
    <div className="lobby-footer">{room.status === 'disconnected' ? <><button className="text-button" onClick={onCreate}>Kết nối lại</button><button className="text-button" onClick={onOffline}>Chơi một mình</button></> : <><span>{room.selfId === room.hostId ? 'Bạn là chủ phòng' : 'Chờ chủ phòng bắt đầu'}</span><button className="text-button" disabled={room.status === 'connecting'} onClick={onCreate}>Phòng mới</button></>}</div>
  </section>;
}
