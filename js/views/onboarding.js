import { createChild } from '../model.js';
import { correctedAgeDays, ageMonths, ageStatus } from '../age.js';

export function render(container, { onComplete }) {
  container.innerHTML = `
    <h1>Welcome</h1>
    <p class="muted">A couple of details and we can start.</p>
    <form id="ob">
      <label class="field"><span>Baby's name</span>
        <input name="name" required autocomplete="off"></label>
      <label class="field"><span>Date of birth</span>
        <input name="dob" type="date" required></label>
      <label class="field"><span>Was he born early?</span>
        <select name="preterm">
          <option value="">No, born at term</option>
          <option value="36">Yes — 36 weeks</option>
          <option value="34">Yes — 34 weeks</option>
          <option value="32">Yes — 32 weeks</option>
          <option value="30">Yes — 30 weeks</option>
          <option value="28">Yes — 28 weeks or earlier</option>
        </select></label>
      <p class="muted">Sleep norms are based on corrected age, so this keeps
        the suggestions accurate.</p>

      <div class="card">
        <h2>Safe sleep</h2>
        <ul class="muted">
          <li>On his back for every sleep, until he turns one.</li>
          <li>Firm, flat surface. Nothing in the crib but a fitted sheet.</li>
          <li>Share a room, not a bed, ideally for at least the first six months.</li>
          <li>Car seats, swings and strollers aren't for routine sleep.</li>
          <li>Stop swaddling as soon as he tries to roll.</li>
        </ul>
        <p class="muted">Summarised from the American Academy of Pediatrics, 2022.</p>
      </div>

      <div class="card notice">
        <p>This app is a planning aid, not medical advice. Sleep varies enormously
          between healthy babies — at nine months the normal range runs from about
          10.5 to 17.4 hours a day. His cues matter more than any suggestion here.
          Anything that worries you belongs with your pediatrician.</p>
      </div>

      <label class="field"><span>
        <input type="checkbox" name="ack" required> I've read the above</span></label>
      <p id="err" class="muted" hidden></p>
      <button class="btn" type="submit">Start</button>
    </form>`;

  container.querySelector('#ob').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const dob = f.get('dob');
    const weeks = f.get('preterm') ? Number(f.get('preterm')) : null;
    const months = ageMonths(correctedAgeDays(dob, weeks, new Date()));
    const err = container.querySelector('#err');

    if (ageStatus(months) === 'too-young') {
      err.hidden = false;
      err.textContent = 'Published sleep guidance starts at four months, so the '
        + 'suggestions here would not be meaningful yet. Come back in a few weeks.';
      return;
    }
    if (ageStatus(months) === 'too-old') {
      err.hidden = false;
      err.textContent = 'This app covers four to twenty-four months.';
      return;
    }
    await onComplete(createChild({
      name: f.get('name').trim(), dob, gestationalWeeksAtBirth: weeks,
    }));
  });
}
