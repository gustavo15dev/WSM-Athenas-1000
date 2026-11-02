import React from 'react';
import { 
  BookOpen, 
  GraduationCap, 
  BrainCircuit, 
  FlaskConical, 
  Sparkles, 
  Flame, 
  Award, 
  Target, 
  Users, 
  Globe, 
  Calculator, 
  Atom, 
  Microscope, 
  Palette, 
  Code, 
  Rocket,
  Compass,
  Star,
  Zap,
  Bookmark
} from 'lucide-react';

export const CLASS_ICON_OPTIONS = [
  { id: 'BookOpen', label: 'Livro', Icon: BookOpen },
  { id: 'GraduationCap', label: 'Formatura', Icon: GraduationCap },
  { id: 'BrainCircuit', label: 'Cérebro / IA', Icon: BrainCircuit },
  { id: 'FlaskConical', label: 'Química / Lab', Icon: FlaskConical },
  { id: 'Sparkles', label: 'Estrelas / Magia', Icon: Sparkles },
  { id: 'Flame', label: 'Ofensiva / Foco', Icon: Flame },
  { id: 'Award', label: 'Troféu / Prêmio', Icon: Award },
  { id: 'Target', label: 'Meta / Alvo', Icon: Target },
  { id: 'Users', label: 'Turma', Icon: Users },
  { id: 'Globe', label: 'Geografia / Globo', Icon: Globe },
  { id: 'Calculator', label: 'Matemática', Icon: Calculator },
  { id: 'Atom', label: 'Física / Átomo', Icon: Atom },
  { id: 'Microscope', label: 'Biologia', Icon: Microscope },
  { id: 'Palette', label: 'Artes / Design', Icon: Palette },
  { id: 'Code', label: 'Computação', Icon: Code },
  { id: 'Rocket', label: 'Foguete', Icon: Rocket },
  { id: 'Compass', label: 'História / Bússola', Icon: Compass },
  { id: 'Star', label: 'Estrela', Icon: Star },
  { id: 'Zap', label: 'Energia', Icon: Zap },
  { id: 'Bookmark', label: 'Marcador', Icon: Bookmark }
];

export function ClassIconDisplay({ icon, className = "w-5 h-5" }: { icon?: string; className?: string }) {
  if (!icon || icon === 'BookOpen') return <BookOpen className={className} />;
  if (icon === 'GraduationCap') return <GraduationCap className={className} />;
  if (icon === 'BrainCircuit') return <BrainCircuit className={className} />;
  if (icon === 'FlaskConical') return <FlaskConical className={className} />;
  if (icon === 'Sparkles') return <Sparkles className={className} />;
  if (icon === 'Flame') return <Flame className={className} />;
  if (icon === 'Award') return <Award className={className} />;
  if (icon === 'Target') return <Target className={className} />;
  if (icon === 'Users') return <Users className={className} />;
  if (icon === 'Globe') return <Globe className={className} />;
  if (icon === 'Calculator') return <Calculator className={className} />;
  if (icon === 'Atom') return <Atom className={className} />;
  if (icon === 'Microscope') return <Microscope className={className} />;
  if (icon === 'Palette') return <Palette className={className} />;
  if (icon === 'Code') return <Code className={className} />;
  if (icon === 'Rocket') return <Rocket className={className} />;
  if (icon === 'Compass') return <Compass className={className} />;
  if (icon === 'Star') return <Star className={className} />;
  if (icon === 'Zap') return <Zap className={className} />;
  if (icon === 'Bookmark') return <Bookmark className={className} />;

  // Render emoji or text icon fallback
  return <span className="text-lg leading-none">{icon}</span>;
}
