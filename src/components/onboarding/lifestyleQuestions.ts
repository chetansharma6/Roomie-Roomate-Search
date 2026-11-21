import {
  CalendarDays, Check, ClipboardList, Clock3, House, Moon, PawPrint, Snowflake,
  Sparkles, Sun, Thermometer, UsersRound, Volume2, VolumeX, Wind,
} from 'lucide-react'
import type { LifestylePriority } from '../../lib/lifestyleDetails'

export const lifestyleQuestions = [
  {
    id: 'temperature', title: 'Temperature at home', icon: Thermometer,
    options: [
      { value: 'cool', label: 'Cool (66–69°F)', icon: Snowflake, dial: '68°' },
      { value: 'moderate', label: 'Moderate (70–73°F)', icon: Thermometer, dial: '72°' },
      { value: 'warm', label: 'Warm (74–77°F)', icon: Sun, dial: '76°' },
      { value: 'flexible', label: 'Flexible', icon: Wind, dial: 'Any' },
    ],
  },
  {
    id: 'cleanliness', title: 'Cleanliness in shared spaces', icon: Sparkles,
    options: [
      { value: 'very_tidy', label: 'Clean up right away', icon: Sparkles },
      { value: 'tidy', label: 'Clean up by the end of the day', icon: Sun },
      { value: 'moderate', label: 'Tidy up a few times a week', icon: CalendarDays },
    ],
  },
  {
    id: 'bedtime', title: 'Weeknight bedtime', icon: Moon,
    options: [
      { value: 'before_10', label: 'Before 10 p.m.', icon: Moon },
      { value: '10_to_midnight', label: '10 p.m.–midnight', icon: Clock3 },
      { value: 'after_midnight', label: 'After midnight', icon: Sparkles },
      { value: 'varies', label: 'It varies', icon: CalendarDays },
    ],
  },
  {
    id: 'guests', title: 'How often you have friends over', icon: UsersRound,
    options: [
      { value: 'rarely', label: 'Rarely', icon: House },
      { value: 'monthly', label: 'A few times a month', icon: CalendarDays },
      { value: 'weekly', label: 'About once a week', icon: UsersRound },
      { value: 'several_weekly', label: 'Several times a week', icon: UsersRound },
    ],
  },
  {
    id: 'quiet', title: 'Quiet at home', icon: VolumeX,
    options: [
      { value: 'quiet', label: 'Quiet most of the time', icon: VolumeX },
      { value: 'moderate', label: 'Quiet during study and sleep', icon: Moon },
      { value: 'lively', label: 'Everyday noise is fine', icon: Volume2 },
    ],
  },
  {
    id: 'chores', title: 'Splitting chores', icon: ClipboardList,
    options: [
      { value: 'rotate', label: 'Rotate on a schedule', icon: CalendarDays },
      { value: 'divide', label: 'Agree on who does what', icon: UsersRound },
      { value: 'as_needed', label: 'Handle things as they come up', icon: Check },
    ],
  },
  {
    id: 'pets', title: 'Pets', icon: PawPrint,
    options: [
      { value: 'has_pets', label: 'I have a pet', icon: PawPrint },
      { value: 'pets_ok', label: 'I’m open to pets', icon: Check },
      { value: 'no_pets', label: 'I prefer a pet-free home', icon: House },
    ],
  },
] as const

export type LifestyleQuestion = (typeof lifestyleQuestions)[number]
type CompleteLifestyleAnswers = {
  [Question in LifestyleQuestion as Question['id']]: Question['options'][number]['value']
}
export type LifestyleAnswers = Partial<CompleteLifestyleAnswers>
export type DemoLifestyleAnswers = CompleteLifestyleAnswers & {
  priorities: readonly [] | readonly [LifestylePriority] | readonly [LifestylePriority, LifestylePriority]
}
