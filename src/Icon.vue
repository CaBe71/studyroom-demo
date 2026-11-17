<script setup>
defineProps({ name: String, size: {default: 20} })
const paths = {
 book: 'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H3V4zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h5V4z',
 grid: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z',
 calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2z',
 clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 check: 'm5 12 4 4L19 6',
 arrow: 'M4 12h16m-6-6 6 6-6 6',
 pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 exit: 'M9 4H4v16h5m5-12 4 4-4 4m-6-4h12',
 chair: 'M6 12V4h12v8M4 12h16v5H4zm2 5v4m12-4v4',
 info: 'M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
 power: 'm13 2-8 12h6l-1 8 9-13h-7z',
 sun: 'M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0',
 refresh: 'M20 7v5h-5M4 17v-5h5m-4 0a7 7 0 0 1 12-6l3 3M4 15l3 3a7 7 0 0 0 12-6',
 list: 'M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1',
 user: 'M20 21v-3a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v3M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 plus: 'M12 5v14M5 12h14',
 close: 'm6 6 12 12M6 18 18 6',
 shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6zM8 12l3 3 5-6'
}
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name] || paths.book"/></svg></template>

