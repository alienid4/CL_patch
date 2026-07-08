離線環境（無網路）函式庫放置說明
=====================================

本工具預設從 CDN 載入 SheetJS 與 Chart.js，可開箱即用。
若你的環境無法連外網（公司內網 / 隔離環境），請依下列步驟改為離線本機檔：

1. 在有網路的電腦下載兩個檔案，改成下列檔名放到本資料夾 assets/vendor/：

   xlsx.full.min.js
     來源：https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js

   chart.umd.min.js
     來源：https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js

2. 編輯 index.html，把「相依函式庫」區塊的兩行 CDN <script> 註解掉，
   改用下方已備好的離線 <script>（把註解打開）：

   <script src="assets/vendor/xlsx.full.min.js"></script>
   <script src="assets/vendor/chart.umd.min.js"></script>

3. 直接用瀏覽器開啟 index.html 即可，無需架站。
   （若瀏覽器對 file:// 有限制，可用任一靜態伺服器，例如：
      python -m http.server 8080
    再開 http://localhost:8080/ ）

檔案僅在本機瀏覽器解析，不會上傳到任何伺服器。
