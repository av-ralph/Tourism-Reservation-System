import {useCallback,useMemo,useRef,useState} from 'react'
import {CellApiModule,ClientSideRowModelModule,ColumnApiModule,CsvExportModule,NumberEditorModule,NumberFilterModule,PaginationModule,SelectEditorModule,TextEditorModule,TextFilterModule,themeQuartz} from 'ag-grid-community'
import {AgGridProvider,AgGridReact} from 'ag-grid-react'

const modules=[ClientSideRowModelModule,ColumnApiModule,CellApiModule,TextFilterModule,NumberFilterModule,TextEditorModule,NumberEditorModule,SelectEditorModule,PaginationModule,CsvExportModule]
const theme=themeQuartz.withParams({accentColor:'#e76626',backgroundColor:'#ffffff',foregroundColor:'#19375b',headerBackgroundColor:'#eaf0f7',borderColor:'#c7d4e4',fontFamily:'Manrope, Arial, sans-serif',fontSize:13,rowHoverColor:'#fff7f1'})
const report=(quantity,unit)=>quantity||unit?`${quantity||'—'}${unit?' '+unit:''}`:'—'

export default function InventorySheet({items,request,onChange,onEdit}){
 const grid=useRef(null)
 const [saving,setSaving]=useState('')
 const [message,setMessage]=useState('')
 const columns=useMemo(()=>[
  {field:'name',headerName:'Item / equipment',minWidth:230,pinned:'left',editable:true},
  {field:'category',headerName:'Category',minWidth:155,editable:true},
  {field:'quantity',headerName:'Booking stock',minWidth:145,editable:true,filter:'agNumberColumnFilter',cellDataType:'number'},
  {field:'unit',headerName:'Unit',minWidth:105,editable:true},
  {field:'status',headerName:'Student availability',minWidth:175,editable:true,cellEditor:'agSelectCellEditor',cellEditorParams:{values:['Draft','Available','Unavailable']}},
  {field:'model',headerName:'Model',minWidth:180,editable:true},
  {field:'serial',headerName:'Serial',minWidth:170,editable:true},
  {field:'notes',headerName:'Current notes',minWidth:230,editable:true},
  {headerName:'Previous in report',valueGetter:params=>report(params.data?.reportPreviousQuantity,params.data?.reportPreviousUnit),minWidth:165},
  {headerName:'Actual in report',valueGetter:params=>report(params.data?.reportActualQuantity,params.data?.reportActualUnit),minWidth:155},
  {headerName:'Required in report',valueGetter:params=>report(params.data?.reportRequiredQuantity,params.data?.reportRequiredUnit),minWidth:165},
  {field:'reportRemarks',headerName:'Report remarks',minWidth:220},
  {headerName:'Details',minWidth:110,pinned:'right',sortable:false,filter:false,cellRenderer:params=><button type="button" className="inventory-sheet-edit" onClick={()=>onEdit(params.data)}>Edit</button>},
 ],[onEdit])
 const saveCell=useCallback(async event=>{
  const field=event.colDef.field
  if(!field||saving)return
  const value=field==='quantity'?String(event.newValue??''):String(event.newValue??'').trim()
  if(String(event.oldValue??'')===value)return
  if(field==='quantity'&&!/^(0|[1-9]\d{0,4})$/.test(value)){setMessage('Booking stock must be a whole number from 0 to 99,999.');return}
  if(field==='status'&&value==='Available'&&Number(event.data.quantity)<1){setMessage('Set booking stock above zero before making an item available.');return}
  setSaving(event.data.id);setMessage('')
  try{
   const saved=await request('inventory/'+encodeURIComponent(event.data.id),{method:'PATCH',body:JSON.stringify({[field]:value})})
   onChange(current=>current.map(item=>item.id===saved.id?saved:item))
   setMessage(`${saved.name} saved.`)
  }catch(error){setMessage(error.message||'Could not save the change. Please try again.')}
  finally{setSaving('')}
 },[onChange,request,saving])
 return <div className="inventory-sheet-view">
  <div className="inventory-sheet-toolbar"><p>Double-click a cell to edit. Changes save when you finish a cell. The original report columns are read-only.</p><button type="button" className="secondary" onClick={()=>grid.current?.api.exportDataAsCsv({fileName:'laboratory-inventory.csv'})}>Download CSV ↓</button></div>
  {(message||saving)&&<div className="inventory-sheet-message" role="status">{saving?'Saving change…':message}</div>}
  <div className="inventory-sheet-grid" role="region" aria-label="Editable laboratory inventory sheet">
   <AgGridProvider modules={modules}><AgGridReact ref={grid} theme={theme} rowData={items} columnDefs={columns} defaultColDef={{sortable:true,filter:true,resizable:true,editable:false}} getRowId={params=>params.data.id} readOnlyEdit onCellEditRequest={saveCell} pagination paginationPageSize={25} paginationPageSizeSelector={[25,50,100]} rowHeight={44} headerHeight={46} /></AgGridProvider>
  </div>
 </div>
}
