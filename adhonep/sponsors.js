const filters = document.querySelectorAll('[data-sector]');
const search = document.querySelector('#sponsor-search');
const profiles = document.querySelectorAll('.sponsor-profile');
const empty = document.querySelector('#empty-results');
let sector = 'all';
function update(){const term=search.value.trim().toLowerCase();let visible=0;profiles.forEach(profile=>{const sectorMatch=sector==='all'||profile.dataset.sectors.split(' ').includes(sector);const searchMatch=!term||profile.dataset.search.includes(term);profile.hidden=!(sectorMatch&&searchMatch);if(!profile.hidden)visible++;});empty.hidden=visible>0;}
filters.forEach(button=>button.addEventListener('click',()=>{filters.forEach(item=>item.classList.remove('active'));button.classList.add('active');sector=button.dataset.sector;update();}));search.addEventListener('input',update);
