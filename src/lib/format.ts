export const rupiah=(n:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n);
export const shortTime=(iso:string)=>new Intl.DateTimeFormat('id-ID',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'}).format(new Date(iso));
