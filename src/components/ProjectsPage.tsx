/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Award, Globe, FlaskConical, ArrowLeft, Trophy, CheckCircle2 } from 'lucide-react';

interface ProjectsPageProps {
  onBack: () => void;
}

interface ProjectItem {
  id: string;
  title: string;
  description: string;
  icon: typeof Award;
  scope: string;
  statusBadge: string;
  yearOrEdition?: string;
  highlightTag?: string;
}

const PROJECTS_LIST: ProjectItem[] = [
  {
    id: 'febrace-2027',
    title: 'FEBRACE 2027',
    description: 'A maior mostra nacional de projetos científicos e tecnológicos voltada para a educação básica e técnica no Brasil.',
    icon: Trophy,
    scope: 'Nacional • Brasil',
    statusBadge: 'Edição Programada',
    yearOrEdition: '2027',
    highlightTag: 'Feira Brasileira de Ciências e Engenharia'
  },
  {
    id: 'ml-empowerment',
    title: 'ML Empowerment Build Challenge 3.0',
    description: 'Uma iniciativa global em formato de hackathon online organizada pela ML Empowerment Foundation (internacional)',
    icon: Globe,
    scope: 'Global • Internacional',
    statusBadge: 'Hackathon Internacional',
    yearOrEdition: 'Edição 3.0',
    highlightTag: 'ML Empowerment Foundation'
  },
  {
    id: 'instituto-3m',
    title: 'Mostra de Ciências e Tecnologia do Instituto 3M',
    description: 'Evento educacional e científico voltado para incentivar jovens estudantes a desenvolverem pesquisas e soluções inovadoras para problemas do cotidiano',
    icon: FlaskConical,
    scope: 'Ciência & Tecnologia • Brasil',
    statusBadge: 'Inovação & Pesquisa',
    yearOrEdition: 'Mostra Científica',
    highlightTag: 'Instituto 3M'
  }
];

export default function ProjectsPage({ onBack }: ProjectsPageProps) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-[#0B0F0E] font-sans text-[#F1F5F3]">

      {/* Top Navbar */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between py-3.5 px-4 sm:px-6 z-20 border border-[#27322D] bg-[#111715] rounded-xl">
        <div className="flex items-center gap-3">
          <img
            src="https://res.cloudinary.com/dqx8p8orf/image/upload/f_auto/q_auto/gallery_image_20260927_114822-sem-mexer-em-mais-nada-nesse-boneco-mantenha-a-con-removebg-preview_3_ewaz6x.png"
            alt="Mascote WSM Athenas"
            referrerPolicy="no-referrer"
            className="w-9 h-9 sm:w-10 sm:h-10 object-contain select-none"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-base sm:text-lg font-bold tracking-tight text-[#F1F5F3]">
              <span className="text-[#55E6B5]">WSM</span> Athenas
            </span>
          </div>
        </div>

        <button
          onClick={onBack}
          className="px-3.5 py-2 bg-[#171E1B] hover:bg-[#1D2723] border border-[#27322D] hover:border-[#55E6B5]/40 text-[#F1F5F3] font-medium text-xs sm:text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4 text-[#55E6B5]" />
          <span>Voltar ao Início</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-6xl mx-auto flex-1 py-10 sm:py-14 z-10">
        {/* Header Title & Subtitle */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-14 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#171E1B] border border-[#27322D] text-[#55E6B5] text-xs font-medium uppercase tracking-wide">
            <Award className="w-3.5 h-3.5 text-[#55E6B5]" />
            <span>Trajetória Científica</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#F1F5F3] leading-[1.1]">
            Projetos
          </h1>

          <p className="text-sm sm:text-base text-[#A5B0AA] font-normal leading-relaxed">
            Todos os projetos/premiações que o WSM Athenas está participando/já participou:
          </p>
        </div>

        {/* Projects Cards List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PROJECTS_LIST.map((project) => {
            const IconComponent = project.icon;
            return (
              <div
                key={project.id}
                className="group flex flex-col justify-between p-6 rounded-xl bg-[#111715] border border-[#27322D] hover:border-[#55E6B5]/50 hover:bg-[#171E1B] transition-colors duration-200 text-left"
              >
                <div className="space-y-4">
                  {/* Top Bar with Icon & Status Badge */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#171E1B] group-hover:bg-[#111715] border border-[#27322D] flex items-center justify-center text-[#55E6B5] transition-colors">
                      <IconComponent className="w-5 h-5 text-[#55E6B5]" />
                    </div>

                    <span className="px-2 py-0.5 rounded text-[11px] font-medium border border-[#27322D] bg-[#171E1B] text-[#55E6B5]">
                      {project.statusBadge}
                    </span>
                  </div>

                  {/* Title and tags */}
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#77827C] block mb-1">
                      {project.scope}
                    </span>
                    <h3 className="text-xl font-bold text-[#F1F5F3] group-hover:text-[#55E6B5] transition-colors tracking-tight leading-snug">
                      {project.title}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-[#A5B0AA] text-xs sm:text-sm leading-relaxed border-t border-[#27322D] pt-3.5">
                    {project.description}
                  </p>
                </div>

                {/* Card Footer */}
                <div className="pt-4 mt-5 border-t border-[#27322D] flex items-center justify-between text-xs text-[#77827C]">
                  <span className="inline-flex items-center gap-1.5 text-[#A5B0AA]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#55E6B5]" />
                    <span>{project.highlightTag}</span>
                  </span>
                  {project.yearOrEdition && (
                    <span className="text-[11px] text-[#55E6B5] font-medium bg-[#171E1B] px-2 py-0.5 rounded border border-[#27322D]">
                      {project.yearOrEdition}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Callout */}
        <div className="mt-12 sm:mt-14 p-6 sm:p-8 rounded-xl bg-[#111715] border border-[#27322D] text-center max-w-2xl mx-auto space-y-3">
          <div className="w-9 h-9 rounded-lg bg-[#171E1B] border border-[#27322D] flex items-center justify-center mx-auto text-[#55E6B5]">
            <Award className="w-4 h-4" />
          </div>
          <h4 className="text-base font-semibold text-[#F1F5F3]">Compromisso Científico e Tecnológico</h4>
          <p className="text-xs sm:text-sm text-[#A5B0AA] leading-relaxed">
            O WSM Athenas estimula a pesquisa aplicada, o pensamento científico e o desenvolvimento de soluções inovadoras para a comunidade.
          </p>
          <div className="pt-1">
            <button
              onClick={onBack}
              className="px-4 py-2 bg-[#55E6B5] hover:bg-[#7AF0C8] text-[#07110D] font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retornar ao Portal</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-6xl mx-auto py-5 text-center text-xs text-[#77827C] z-10 border-t border-[#27322D] mt-6">
        <p>© {new Date().getFullYear()} WSM Athenas. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
