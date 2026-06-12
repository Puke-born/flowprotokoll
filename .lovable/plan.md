Plan:

1. Byt strategi för formelfältet när tangentbordet är öppet
   - Sluta flytta fältet med `visualViewport.offsetTop` vid varje scroll/resize, eftersom det kan ge hopp och lagg på surfplatta.
   - Gör formelfältet till en egen `fixed` toppbar när en cell är aktiv och tangentbordet är uppe.
   - Placera det stabilt vid toppen av synlig viewport med `transform: translateY(...)` i stället för att ändra layouten.

2. Minska lagg vid scroll/tangentbord
   - Throttla viewport-uppdateringar via `requestAnimationFrame`.
   - Uppdatera bara state när värden faktiskt ändras.
   - Undvik onödiga React-renderingar medan användaren scrollar med tangentbordet öppet.

3. Förhindra att innehåll hamnar under formelfältet
   - Lägg till dynamisk topp-padding i huvudytan när formelfältet ligger fixed.
   - Behåll nuvarande normala layout när tangentbordet inte är öppet.

4. Verifiera i surfplattevy
   - Kontrollera att formelfältet fortsätter synas vid fokus i cell, tangentbordsläge och scroll.
   - Kontrollera att översta knappraden fortfarande får försvinna som tidigare.