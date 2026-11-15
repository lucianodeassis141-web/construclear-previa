(function(){
  document.documentElement.classList.add('js');
  var b=document.querySelector('.abrir-menu'),m=document.getElementById('menu');
  if(b&&m){b.addEventListener('click',function(){var a=m.classList.toggle('aberto');b.setAttribute('aria-expanded',a)});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&m.classList.contains('aberto')){m.classList.remove('aberto');b.setAttribute('aria-expanded','false');b.focus()}})}
  var r=document.querySelectorAll('.rev');
  if('IntersectionObserver' in window){var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('vis');o.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});r.forEach(function(e){o.observe(e)})}
  else r.forEach(function(e){e.classList.add('vis')});
  document.querySelectorAll('[data-ano]').forEach(function(e){e.textContent=new Date().getFullYear()});
})();
