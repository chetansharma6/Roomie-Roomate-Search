import { priorityLabels } from '../../lib/lifestyleDetails';
import { lifestyleQuestions, type DemoLifestyleAnswers } from '../onboarding/lifestyleQuestions';

export function DemoHabits({ answers }: { answers: DemoLifestyleAnswers }) {
  return (
    <>
      <section className="demo-habits" aria-label="Roommate habits">
        <h3>Roommate habits</h3>
        <dl className="lifestyle-list">
          {lifestyleQuestions.map(({ id, title, options }) => (
            <div key={id}>
              <dt>{title}</dt>
              <dd>{options.find(({ value }) => value === answers[id])?.label}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="demo-habits" aria-label="What matters most to them">
        <h3>What matters most to them</h3>
        <ul className="student-tags">
          {answers.priorities.map((priority) => <li key={priority}>{priorityLabels[priority]}</li>)}
        </ul>
      </section>
    </>
  );
}
