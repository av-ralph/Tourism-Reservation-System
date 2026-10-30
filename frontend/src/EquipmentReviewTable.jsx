import {reservationItems} from './reservation-form'

export default function EquipmentReviewTable({reservation,id='review-equipment-title'}){
 const items=reservationItems(reservation).filter(item=>item.description&&item.description!=='None')
 return <section className="review-equipment-section" aria-labelledby={id}><div className="review-equipment-heading"><div><span className="eyebrow">REQUESTED RESOURCES</span><h3 id={id}>Items / Equipment</h3></div><span className="review-equipment-count">{items.length} {items.length===1?'item':'items'}</span></div><div className="review-equipment-scroll"><table className="review-equipment-table" aria-label="Requested equipment"><thead><tr><th scope="col">No.</th><th scope="col">Item / Equipment</th><th scope="col">Quantity</th></tr></thead><tbody>{items.length?items.map((item,index)=><tr key={`${item.description}-${index}`}><td>{index+1}</td><td>{item.description}</td><td><strong>{item.quantity||'Not specified'}</strong></td></tr>):<tr><td colSpan="3" className="review-equipment-empty">No equipment requested for this reservation.</td></tr>}</tbody></table></div></section>
}
