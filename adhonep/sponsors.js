const filters = document.querySelectorAll('[data-sector]');
const search = document.querySelector('#sponsor-search');
const profiles = document.querySelectorAll('.sponsor-profile');
const empty = document.querySelector('#empty-results');
let sector = 'all';
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
function update(){const term=normalize(search?.value.trim());let visible=0;profiles.forEach(profile=>{const sectorMatch=sector==='all'||profile.dataset.sectors.split(' ').includes(sector);const searchMatch=!term||normalize(profile.dataset.search).includes(term);profile.hidden=!(sectorMatch&&searchMatch);if(!profile.hidden)visible++;});if(empty)empty.hidden=visible>0;}
filters.forEach(button=>button.addEventListener('click',()=>{filters.forEach(item=>item.classList.remove('active'));button.classList.add('active');sector=button.dataset.sector;update();}));search?.addEventListener('input',update);update();
