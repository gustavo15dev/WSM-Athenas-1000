/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, User, Lock, Sparkles, Key, AlertCircle, CheckCircle, UserPlus, LogIn, 
  Database, CloudLightning, Hash, BookOpen, Building2, RotateCcw, ShieldCheck, Mail, Send,
  MapPin, Search, ChevronDown, Check, GraduationCap
} from 'lucide-react';
import { PortalRole } from '../types';
import { supabase } from '../supabase';
import { safeUpsertUserProfile, safeFetchUserProfile, areTurmasMatching } from '../utils/profileDb';
import { logSystemAction } from '../utils/auditLogger';

const BRAZILIAN_STATES = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
];

interface LoginModalProps {
  role: PortalRole;
  onBack: () => void;
  onLoginSuccess: (email: string) => void;
}

export default function LoginModal({ role, onBack, onLoginSuccess }: LoginModalProps) {
  const isStudent = role === 'student';
  
  // Tab control: 'signin' | 'signup'
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');

  // Custom smart default suggestion
  const defaultEmail = isStudent ? 'gustavo.aluno@athenas.edu.br' : 'athena.prof@athenas.edu.br';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password specific states (Secure Email-Only OTP Reset)
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotGmail, setForgotGmail] = useState('');
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Form touched states for accessible Portuguese validations (P2-04)
  const [touchedEmail, setTouchedEmail] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);
  const [touchedConfirm, setTouchedConfirm] = useState(false);
  const [touchedEscola, setTouchedEscola] = useState(false);
  const [touchedNomeAluno, setTouchedNomeAluno] = useState(false);
  const [touchedChamada, setTouchedChamada] = useState(false);
  const [touchedTurma, setTouchedTurma] = useState(false);
  const [touchedNomeProf, setTouchedNomeProf] = useState(false);
  const [touchedMateriaProf, setTouchedMateriaProf] = useState(false);
  const [touchedEstado, setTouchedEstado] = useState(false);
  const [touchedCidade, setTouchedCidade] = useState(false);

  // Reference for auto-scrolling to error banner
  const errorRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        if (errorRef.current) {
          errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Location and School state (Estado, Cidade, Escola com API INEP Data)
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [cidadeSearch, setCidadeSearch] = useState('');
  const [cidadesList, setCidadesList] = useState<string[]>([]);
  const [loadingCidades, setLoadingCidades] = useState(false);
  const [isCidadeDropdownOpen, setIsCidadeDropdownOpen] = useState(false);

  const [escola, setEscola] = useState('');
  const [escolaInepCode, setEscolaInepCode] = useState('');
  const [escolaRede, setEscolaRede] = useState('');
  const [escolaSearchQuery, setEscolaSearchQuery] = useState('');
  const [inepSchools, setInepSchools] = useState<any[]>([]);
  const [loadingInep, setLoadingInep] = useState(false);
  const [isEscolaDropdownOpen, setIsEscolaDropdownOpen] = useState(false);
  const [schoolSelected, setSchoolSelected] = useState<any | null>(null);

  // 1. Fetch Brazilian municipalities from official IBGE API when state changes
  useEffect(() => {
    if (!estado) {
      setCidadesList([]);
      setCidade('');
      setCidadeSearch('');
      setEscola('');
      setSchoolSelected(null);
      setInepSchools([]);
      return;
    }

    let isMounted = true;
    setLoadingCidades(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado}/municipios?orderBy=nome`)
      .then(res => res.json())
      .then((data: any[]) => {
        if (!isMounted) return;
        if (Array.isArray(data)) {
          const names = data.map((m: any) => m.nome).filter(Boolean);
          setCidadesList(names);
        }
      })
      .catch(err => {
        console.warn('Erro ao carregar municípios do IBGE:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingCidades(false);
      });

    return () => {
      isMounted = false;
    };
  }, [estado]);

  // 2. Fetch INEP school catalog when state, city or school query changes
  useEffect(() => {
    if (!estado || !cidade) {
      setInepSchools([]);
      return;
    }

    const timer = setTimeout(() => {
      setLoadingInep(true);
      fetch(`/api/inep/schools?uf=${encodeURIComponent(estado)}&cidade=${encodeURIComponent(cidade)}&q=${encodeURIComponent(escolaSearchQuery)}`)
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.schools)) {
            setInepSchools(data.schools);
          } else {
            setInepSchools([]);
          }
        })
        .catch(err => {
          console.warn('Erro ao consultar API INEP Data:', err);
        })
        .finally(() => {
          setLoadingInep(false);
        });
    }, 280);

    return () => clearTimeout(timer);
  }, [estado, cidade, escolaSearchQuery]);

  const handleSelectInepSchool = (sch: any) => {
    setSchoolSelected(sch);
    const formatted = `${sch.nome} (INEP: ${sch.codigoInep})`;
    setEscola(formatted);
    setEscolaInepCode(sch.codigoInep || '');
    setEscolaRede(sch.rede || '');
    setEscolaSearchQuery(sch.nome);
    setIsEscolaDropdownOpen(false);
    if (error) setError('');
  };

  const handleUseCustomSchool = () => {
    if (!escolaSearchQuery.trim()) return;
    const custom = {
      id: `custom-${Date.now()}`,
      nome: escolaSearchQuery.trim(),
      codigoInep: 'Não informado',
      rede: 'Escola'
    };
    setSchoolSelected(custom);
    setEscola(escolaSearchQuery.trim());
    setIsEscolaDropdownOpen(false);
    if (error) setError('');
  };

  // Student registration specific states
  const [nomeAluno, setNomeAluno] = useState('');
  const [turma, setTurma] = useState('');
  const [numeroChamada, setNumeroChamada] = useState('');

  // Teacher registration specific states
  const [nomeProfessor, setNomeProfessor] = useState('');
  const [materiaProfessor, setMateriaProfessor] = useState('');
  const [turmasProfessor, setTurmasProfessor] = useState<string[]>([]);

  // Validation rules with strict email normalization & typo detection
  const normalizedEmail = email.trim().toLowerCase();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const isLikelyIncompleteDomain = normalizedEmail.includes('@') && (
    normalizedEmail.endsWith('.co') || 
    normalizedEmail.endsWith('.con') || 
    normalizedEmail.endsWith('.cpm') || 
    normalizedEmail.endsWith('.comm')
  ) && !normalizedEmail.endsWith('.com.br') && !normalizedEmail.endsWith('.edu.co') && !normalizedEmail.endsWith('.gov.co');

  const isPasswordValid = password.length >= 6;
  const isConfirmValid = activeTab === 'signin' || (password === confirmPassword && confirmPassword.length >= 6);
  const isEscolaValid = activeTab === 'signin' || (
    escola.trim().length > 0 && 
    (!isStudent || (estado.trim().length > 0 && cidade.trim().length > 0))
  );
  const isStudentValid = !isStudent || activeTab === 'signin' || (
    nomeAluno.trim().length > 0 &&
    numeroChamada.trim().length > 0 &&
    parseInt(numeroChamada) > 0
  );
  const isTeacherValid = isStudent || activeTab === 'signin' || (
    nomeProfessor.trim().length > 0 &&
    materiaProfessor.trim().length > 0
  );
  const isFormValid = isEmailValid && isPasswordValid && isConfirmValid && isEscolaValid && isStudentValid && isTeacherValid;

  // Clear states on tab change
  useEffect(() => {
    setError('');
    setSuccessMsg('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setEscola('');
    setEstado('');
    setCidade('');
    setCidadeSearch('');
    setCidadesList([]);
    setEscolaSearchQuery('');
    setSchoolSelected(null);
    setInepSchools([]);
    setNomeAluno('');
    setTurma('');
    setNumeroChamada('');
    setNomeProfessor('');
    setMateriaProfessor('');
    setTurmasProfessor([]);
    setTouchedEmail(false);
    setTouchedPassword(false);
    setTouchedConfirm(false);
    setTouchedEstado(false);
    setTouchedCidade(false);
  }, [activeTab]);

  const handleFillDemo = () => {
    setEmail(defaultEmail);
    setPassword('athenas26');
  };

  const handleRequestResetToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    const targetEmail = forgotEmail.toLowerCase().trim();
    const recipientEmail = forgotGmail.toLowerCase().trim();

    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setResetError('Por favor, informe um endereço de e-mail válido para a conta do aluno.');
      return;
    }

    if (!recipientEmail) {
      setResetError('Por favor, informe o e-mail do Gmail que vai receber o código.');
      return;
    }

    if (!recipientEmail.endsWith('@gmail.com') || recipientEmail === '@gmail.com' || !/^[^\s@]+@gmail\.com$/.test(recipientEmail)) {
      setResetError('O e-mail para receber o código deve ser obrigatoriamente um endereço do Gmail terminado em "@gmail.com".');
      return;
    }

    setForgotLoading(true);
    try {
      // Call secure server endpoint to generate OTP and dispatch email
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, recipientEmail }),
      });

      let data: any = null;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: res.ok, message: text || 'Erro de comunicação com o servidor.' };
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Falha ao solicitar código de recuperação. Verifique os e-mails digitados.');
      }

      // Register security audit log
      await logSystemAction({
        userEmail: targetEmail,
        userName: 'Usuário',
        role: isStudent ? 'student' : 'teacher',
        action: 'PASSWORD_RESET_TOKEN_REQUESTED',
        details: `Solicitação de código de segurança (OTP) de uso único para a conta ${targetEmail}, enviada para o Gmail ${recipientEmail}.`,
        metadata: { method: 'email_otp', recipientEmail, expiresMinutes: 15 }
      });

      // Clear previous input states and advance to step 2
      setResetTokenInput('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setForgotStep(2);
    } catch (err: any) {
      console.error('Password reset request error:', err);
      setResetError(err.message || 'Erro ao processar solicitação de recuperação. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleConfirmResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    const targetEmail = forgotEmail.toLowerCase().trim();
    const tokenClean = resetTokenInput.trim();

    if (!tokenClean || tokenClean.length !== 6) {
      setResetError('Por favor, digite o código de 6 dígitos recebido por e-mail.');
      return;
    }

    if (resetNewPassword.length < 6) {
      setResetError('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('As senhas digitadas não coincidem.');
      return;
    }

    setForgotLoading(true);
    try {
      // Verify OTP and reset password on the server
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          token: tokenClean,
          newPassword: resetNewPassword,
        }),
      });

      let data: any = null;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { success: res.ok, message: text || 'Erro de comunicação com o servidor.' };
      }

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || 'Código incorreto ou expirado. Verifique os 6 dígitos recebidos no seu e-mail.');
      }

      // Update password in local registered users store if present
      const users = getStoredUsers();
      const userIndex = users.findIndex((u: any) => u.email?.toLowerCase().trim() === targetEmail);
      if (userIndex !== -1) {
        users[userIndex].password = resetNewPassword;
        localStorage.setItem('athenas_registered_users', JSON.stringify(users));
      }

      // Register audit log - never exposes passwords or OTPs
      await logSystemAction({
        userEmail: targetEmail,
        userName: 'Usuário',
        role: isStudent ? 'student' : 'teacher',
        action: 'PASSWORD_RESET_COMPLETED',
        details: 'Senha redefinida com sucesso com token de uso único (OTP) validado via e-mail. Senhas mantidas sob sigilo.',
        metadata: { method: 'email_otp_verified', success: true }
      });

      // Clear states and redirect to signin
      setEmail(targetEmail);
      setPassword('');
      setResetTokenInput('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setShowForgot(false);
      setForgotStep(1);
      setSuccessMsg('Senha redefinida com sucesso! Você já pode entrar com a sua nova senha.');
    } catch (err: any) {
      console.error('Password reset confirmation error:', err);
      setResetError(err.message || 'Erro ao atualizar a senha. Tente novamente.');
    } finally {
      setForgotLoading(false);
    }
  };

  const getStoredUsers = (): any[] => {
    const raw = localStorage.getItem('athenas_registered_users');
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  };

  const saveStoredUser = (user: any) => {
    const users = getStoredUsers();
    // Exclude if exists
    const filtered = users.filter(u => u.email.toLowerCase() !== user.email.toLowerCase());
    filtered.push(user);
    localStorage.setItem('athenas_registered_users', JSON.stringify(filtered));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const targetEmail = email.trim().toLowerCase();
    const targetPassword = password;

    if (!targetEmail) {
      setError('Por favor, informe um endereço de e-mail.');
      return;
    }

    if (!targetPassword) {
      setError('Por favor, informe uma senha.');
      return;
    }

    if (activeTab === 'signup') {
      const forbiddenDomains = ['example.com', 'example.org', 'test.com', 'dummy.com', 'mailinator.com'];
      if (forbiddenDomains.some(d => targetEmail.endsWith(`@${d}`) || targetEmail.includes(`@${d}.`))) {
        setError('Por favor, informe um endereço de e-mail institucional ou pessoal válido (ex: @gmail.com, @colegio.edu.br). Domínios genéricos de teste não são permitidos.');
        return;
      }

      if (targetPassword.length < 6) {
        setError('Para segurança da sua conta, a senha deve ter pelo menos 6 caracteres.');
        return;
      }
      if (targetPassword !== confirmPassword) {
        setError('As senhas não coincidem. Digite novamente com atenção.');
        return;
      }

      if (!escola.trim()) {
        setError('Por favor, informe a sua Escola / Instituição de Ensino.');
        return;
      }

      // If registering as student, check details
      let validClassName = '';
      if (role === 'student') {
        if (!nomeAluno.trim()) {
          setError('Por favor, informe o Nome Completo do aluno.');
          return;
        }
        if (!numeroChamada.trim()) {
          setError('Por favor, informe o Número de Chamada.');
          return;
        }
        const callingNum = parseInt(numeroChamada, 10);
        if (isNaN(callingNum) || callingNum <= 0) {
          setError('Número de chamada inválido. Deve ser maior que 0.');
          return;
        }

        // Room code is optional during registration. If provided, associate it.
        if (turma && turma.trim().length === 4) {
          setIsLoading(true);
          const { data: vClass } = await supabase
            .from('wsm_virtual_classes')
            .select('name, access_code, student_emails')
            .eq('access_code', turma.trim())
            .maybeSingle();

          if (vClass) {
            validClassName = vClass.name;
          }
        }
      }

      // If registering as teacher, check details
      if (role === 'teacher') {
        if (!nomeProfessor.trim()) {
          setError('Por favor, informe o Nome Completo do(a) professor(a).');
          setIsLoading(false);
          return;
        }
        if (!materiaProfessor.trim()) {
          setError('Por favor, informe a Matéria / Disciplina que leciona.');
          setIsLoading(false);
          return;
        }
      }

      setIsLoading(true);
      try {
        // Enforce role separation check before signup
        const { data: existingProfile, error: checkError } = await supabase
          .from('wsm_user_profiles')
          .select('role')
          .ilike('email', targetEmail)
          .maybeSingle();

        if (existingProfile) {
          const roleLabel = existingProfile.role === 'student' ? 'Aluno' : 'Professor';
          setError(`Este e-mail (${targetEmail}) já está cadastrado como ${roleLabel}. Não é possível cadastrá-lo como ${role === 'student' ? 'Aluno' : 'Professor'}.`);
          setIsLoading(false);
          return;
        }

        const fullEscolaData = isStudent && estado && cidade
          ? (schoolSelected?.codigoInep && schoolSelected.codigoInep !== 'Não informado'
              ? `${schoolSelected.nome} (INEP: ${schoolSelected.codigoInep}) - ${cidade}/${estado}`
              : `${escola.trim()} - ${cidade}/${estado}`)
          : escola.trim();

        const { data, error: suError } = await supabase.auth.signUp({
          email: targetEmail,
          password: targetPassword,
          options: {
            data: {
              role: role,
              nome_completo: role === 'student' ? nomeAluno.trim() : nomeProfessor.trim(),
              escola: fullEscolaData,
              turma: role === 'student' ? validClassName : null,
              numero_chamada: role === 'student' ? parseInt(numeroChamada, 10) : null,
              anos_lecionados: role === 'teacher' ? turmasProfessor : null,
              materia: role === 'teacher' ? (materiaProfessor.trim() || 'Biologia') : null
            }
          }
        });

        if (suError) {
          throw suError;
        }

        if (data.user) {
          // Check if user already existed in Supabase Auth (identities empty array)
          if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            setError(`O e-mail ${targetEmail} já possui uma conta cadastrada. Por favor, acesse a aba 'Entrar' ao lado para fazer login.`);
            setIsLoading(false);
            return;
          }

          // Upsert profile details using schema-resilient helper
          const profilePayload = {
            id: data.user.id,
            email: targetEmail,
            role: role,
            nome_completo: role === 'student' ? nomeAluno.trim() : nomeProfessor.trim(),
            escola: fullEscolaData,
            turma: role === 'student' ? validClassName : null,
            numero_chamada: role === 'student' ? parseInt(numeroChamada, 10) : null,
            anos_lecionados: role === 'teacher' ? turmasProfessor : null,
            materia: role === 'teacher' ? (materiaProfessor.trim() || 'Biologia') : null
          };

          const { error: profileError } = await safeUpsertUserProfile(profilePayload);

          if (profileError) {
            console.error('Error creating/updating profile row:', profileError);
            let pMsg = profileError.message || 'Erro ao registrar os dados do perfil acadêmico.';
            if (
              pMsg.toLowerCase().includes('numero_chamada') ||
              pMsg.toLowerCase().includes('duplicate') ||
              pMsg.toLowerCase().includes('unique') ||
              pMsg.toLowerCase().includes('violates')
            ) {
              pMsg = `O número de chamada ${numeroChamada} já está em uso na turma "${validClassName}". Por favor, confirme seu número correto de chamada ou consulte a coordenação.`;
            }
            throw new Error(pMsg);
          }
          
          if (role === 'student' && turma) {
            try {
              const { data: vClass } = await supabase
                .from('wsm_virtual_classes')
                .select('student_emails, id')
                .eq('access_code', turma)
                .maybeSingle();

              if (vClass) {
                const currentEmails = Array.isArray(vClass.student_emails) ? vClass.student_emails : [];
                const updatedEmails = Array.from(new Set([...currentEmails, targetEmail]));
                await supabase
                  .from('wsm_virtual_classes')
                  .update({ student_emails: updatedEmails })
                  .eq('id', vClass.id);
              }
            } catch (vcErr) {
              console.warn('Virtual class enrollment update notice:', vcErr);
            }
          }
        }

        // Direct auto-login! User enters directly without returning to login screen
        let loginEmail = targetEmail;
        if (!data.session) {
          try {
            const { data: siData } = await supabase.auth.signInWithPassword({
              email: targetEmail,
              password: targetPassword
            });
            if (siData?.user?.email) {
              loginEmail = siData.user.email;
            }
          } catch (autoSignErr) {
            console.warn('Auto sign-in notice:', autoSignErr);
          }
        }

        // Cache locally for instant access
        localStorage.setItem('wsm_authenticated_user_email', loginEmail);
        localStorage.setItem(`wsm_profile_nome_${loginEmail}`, role === 'student' ? nomeAluno.trim() : nomeProfessor.trim());
        localStorage.setItem(`wsm_profile_escola_${loginEmail}`, fullEscolaData);
        if (role === 'student') {
          localStorage.setItem(`wsm_profile_chamada_${loginEmail}`, String(numeroChamada.trim()));
          if (validClassName) {
            localStorage.setItem(`wsm_profile_turma_${loginEmail}`, validClassName);
            localStorage.setItem(`wsm_active_student_class_${loginEmail}`, validClassName);
          }
          localStorage.setItem(`wsm_first_access_student_${loginEmail}`, 'true');
        }

        // Call success handler directly - goes right into the site!
        onLoginSuccess(loginEmail);
        return;
      } catch (err: any) {
        console.error('Signup error:', err);
        let msg = err.message || 'Erro ao cadastrar sua conta no sistema.';
        if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many requests')) {
          msg = 'Limite temporário de requisições do servidor atingido. Por favor, aguarde alguns instantes e tente novamente.';
        }
        setError(msg);
      } finally {
        setIsLoading(false);
      }

    } else {
      // Login validation
      setIsLoading(true);
      try {
        const { data, error: siError } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password: targetPassword,
        });

        if (siError) {
          throw siError;
        }

        if (data.user) {
          const userEmail = (data.user.email || targetEmail).toLowerCase().trim();
          const userMeta = data.user.user_metadata || {};

          // Safe profile query
          let profile = await safeFetchUserProfile(userEmail);

          const cachedTurma = localStorage.getItem(`wsm_profile_turma_${userEmail}`) || localStorage.getItem(`wsm_active_student_class_${userEmail}`) || '';
          const cachedChamadaRaw = localStorage.getItem(`wsm_profile_chamada_${userEmail}`);
          const cachedChamada = cachedChamadaRaw ? parseInt(cachedChamadaRaw, 10) : null;
          const cachedNome = localStorage.getItem(`wsm_profile_nome_${userEmail}`) || '';
          const cachedEscola = localStorage.getItem(`wsm_profile_escola_${userEmail}`) || '';

          const resolvedRole = (profile?.role || userMeta.role || role) as 'student' | 'teacher';
          const resolvedTurma = profile?.turma || userMeta.turma || cachedTurma || '';
          const resolvedChamada = profile?.numero_chamada !== undefined && profile?.numero_chamada !== null
            ? profile.numero_chamada
            : (userMeta.numero_chamada !== undefined && userMeta.numero_chamada !== null
              ? userMeta.numero_chamada
              : cachedChamada);
          const resolvedNome = profile?.nome_completo || userMeta.nome_completo || cachedNome || (resolvedRole === 'student' ? 'Estudante' : 'Docente');
          const resolvedEscola = profile?.escola || userMeta.escola || cachedEscola || '';

          // Re-sync and persist the authenticated user profile
          const syncProfilePayload = {
            id: data.user.id,
            email: userEmail,
            role: resolvedRole,
            nome_completo: resolvedNome,
            materia: userMeta.materia || profile?.materia || (resolvedRole === 'teacher' ? 'Biologia' : null),
            turma: resolvedRole === 'student' ? resolvedTurma : null,
            numero_chamada: resolvedRole === 'student' ? (resolvedChamada ?? null) : null,
            anos_lecionados: userMeta.anos_lecionados || profile?.anos_lecionados || null,
            escola: resolvedEscola
          };

          const { data: updatedProfile } = await safeUpsertUserProfile(syncProfilePayload);
          profile = updatedProfile || syncProfilePayload;

          // If student has a class, ensure they are enrolled in the virtual class record
          if (resolvedRole === 'student' && resolvedTurma) {
            try {
              localStorage.setItem(`wsm_profile_turma_${userEmail}`, resolvedTurma);
              localStorage.setItem(`wsm_active_student_class_${userEmail}`, resolvedTurma);
              if (resolvedChamada !== null && resolvedChamada !== undefined) {
                localStorage.setItem(`wsm_profile_chamada_${userEmail}`, String(resolvedChamada));
              }

              // Fetch all matching virtual classes (by name or access_code)
              const { data: vClasses } = await supabase
                .from('wsm_virtual_classes')
                .select('id, name, access_code, student_emails');

              if (vClasses && vClasses.length > 0) {
                const targetVC = vClasses.find((vc: any) => 
                  areTurmasMatching(vc.name, resolvedTurma) ||
                  (vc.access_code && vc.access_code === resolvedTurma)
                );

                if (targetVC) {
                  let emails: string[] = [];
                  if (Array.isArray(targetVC.student_emails)) emails = targetVC.student_emails;
                  else if (typeof targetVC.student_emails === 'string') {
                    try { emails = JSON.parse(targetVC.student_emails); } catch { emails = targetVC.student_emails.split(',').map((s: string) => s.trim()).filter(Boolean); }
                  }

                  if (!emails.some((e: string) => e && e.toLowerCase().trim() === userEmail)) {
                    const newEmails = Array.from(new Set([...emails, userEmail]));
                    await supabase
                      .from('wsm_virtual_classes')
                      .update({ student_emails: newEmails })
                      .eq('id', targetVC.id);
                  }
                }
              }
            } catch (enrollErr) {
              console.warn('Auto-enrollment verification notice:', enrollErr);
            }
          }

          if (profile) {
            if (profile.role && profile.role !== role) {
              await supabase.auth.signOut();
              const reqText = role === 'student' ? 'Aluno' : 'Professor';
              const curText = profile.role === 'student' ? 'Aluno' : 'Professor';
              setError(`Este e-mail está cadastrado como ${curText} e não possui permissão para acessar a área do ${reqText}.`);
              setIsLoading(false);
              return;
            }
          }

          onLoginSuccess(data.user.email || targetEmail);
        } else {
          throw new Error('Nenhum dado de usuário retornado pelo servidor.');
        }
      } catch (err: any) {
        console.error('Signin error:', err);
        const lowerMsg = (err?.message || '').toLowerCase();
        let errMsg = '';
        
        if (
          lowerMsg.includes('invalid login credentials') || 
          lowerMsg.includes('invalid_grant') || 
          lowerMsg.includes('invalid credentials') ||
          lowerMsg.includes('user not found') ||
          lowerMsg.includes('wrong password')
        ) {
          if (isLikelyIncompleteDomain) {
            errMsg = `E-mail ou senha incorretos. Atenção: o endereço digitado (${targetEmail}) termina em um domínio incompleto (${targetEmail.slice(targetEmail.lastIndexOf('.'))}). Verifique se não faltou ".com" ou ".com.br".`;
          } else {
            errMsg = `E-mail ou senha incorretos para "${targetEmail}". Verifique se digitou os dados com exatidão ou se precisa cadastrar a conta na aba "Cadastrar".`;
          }
        } else if (lowerMsg.includes('email not confirmed')) {
          errMsg = 'Este e-mail ainda precisa de confirmação. Por favor, verifique sua caixa de entrada.';
        } else if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many requests')) {
          errMsg = 'Muitas tentativas em sequência. Por favor, aguarde alguns instantes antes de tentar novamente.';
        } else {
          errMsg = err?.message || 'Falha ao autenticar. Verifique sua conexão e tente novamente.';
        }
        
        setError(errMsg);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-start sm:justify-center items-center p-4 sm:p-6 md:p-8 overflow-y-auto uiverse-dark-grid text-white py-6 sm:py-12">
      {/* Background decor */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(2,195,154,0.08),transparent_70%)] pointer-events-none" />
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)]" 
        style={{ backgroundSize: '30px 30px' }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -15 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl relative z-10 rounded-3xl bg-neutral-950/60 border border-neutral-800/80 backdrop-blur-2xl shadow-3xl overflow-visible my-auto"
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 md:min-h-[600px]">
          {/* Lado do Formulário */}
          <div className="col-span-1 md:col-span-6 p-6 sm:p-8 md:p-10 flex flex-col justify-between relative">
            <div>
              {/* Glow corner decorations */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#02c39a]/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-teal-600/5 rounded-full blur-3xl pointer-events-none" />

              {/* Back navigation button */}
              <button
                id="btn-login-voltar"
                onClick={showForgot ? () => { setShowForgot(false); setForgotStep(1); setResetError(''); setForgotGmail(''); } : onBack}
                className="group flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-[#02c39a] transition-colors mb-6 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
                <span>{showForgot ? 'Voltar para o Login' : 'Voltar ao Portal'}</span>
              </button>

              <div className="mb-6">
                <div className="flex justify-center mb-4">
                  <motion.img
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1, duration: 0.5 }}
                    src="https://i.ibb.co/JW6tx1k6/Chat-GPT-Image-21-de-jun-de-2026-17-21-07-removebg-preview.png"
                    alt="Mascote WSM Athenas"
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 object-contain select-none drop-shadow-[0_0_15px_rgba(2,195,154,0.25)]"
                  />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#02c39a]/10 border border-[#02c39a]/20 text-[#02c39a] rounded-full text-xs font-mono font-medium mb-3">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>Portal do {isStudent ? 'Aluno' : 'Professor'}</span>
                </div>
                <h2 className="text-2xl font-extrabold text-neutral-100 font-display tracking-tight">
                  {showForgot ? (forgotStep === 1 ? 'Esqueceu a senha?' : 'Redefinir Senha') : activeTab === 'signin' ? 'Acesse sua área' : 'Crie sua conta'}
                </h2>
                <p className="text-neutral-500 text-xs mt-1.5 leading-relaxed">
                  {showForgot 
                    ? (forgotStep === 1 
                        ? 'Informe o e-mail cadastrado do aluno e o e-mail Gmail onde enviaremos o código de segurança de 6 dígitos.'
                        : 'Informe o código de verificação recebido no seu e-mail e cadastre sua nova senha de acesso.')
                    : activeTab === 'signin' 
                    ? 'Insira as credenciais da sua conta criada para continuar seu percurso no Athenas.'
                    : 'Registre qualquer e-mail para configurar seu acesso instantâneo e obter seu espaço inteligente.'
                  }
                </p>
              </div>

              {showForgot ? (
                <div className="space-y-4 animate-fadeIn">
                  {forgotStep === 1 ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400">
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <span className="font-bold text-sm">Recuperação Segura por E-mail</span>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Por motivos de segurança e privacidade, senhas nunca são exibidas na tela. Enviamos um código de uso único (OTP) para o seu Gmail para autenticar a alteração.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 bg-neutral-900/90 border border-emerald-500/30 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <Mail className="w-4 h-4 shrink-0" />
                          <span className="font-bold text-xs uppercase tracking-wider font-mono">Código Enviado por E-mail</span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono">Válido por 15 min</span>
                      </div>
                      <p className="text-xs text-neutral-300 leading-relaxed">
                        Enviamos um código de segurança de 6 dígitos para o Gmail <strong className="text-emerald-300 font-mono">{forgotGmail}</strong> (referente à conta <strong className="text-neutral-200 font-mono">{forgotEmail}</strong>). Verifique sua caixa de entrada (e a pasta de spam).
                      </p>
                    </div>
                  )}

                  {resetError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  {forgotStep === 1 ? (
                    <form onSubmit={handleRequestResetToken} noValidate className="space-y-4">
                      {/* Campo 1: Email da conta do aluno */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5 flex items-center justify-between">
                          <span>E-mail do Aluno (da conta cadastrada)</span>
                          <span className="text-[10px] text-neutral-500 normal-case font-normal">Conta cadastrada</span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                            <User className="w-4.5 h-4.5" />
                          </span>
                          <input
                            id="input-forgot-student-email"
                            type="email"
                            placeholder="ex: aluno.teste.001@wsmathenas.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-neutral-900/60 border border-neutral-800 focus:border-[#02c39a]/50 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                          />
                        </div>
                      </div>

                      {/* Campo 2: Email para receber o código (obrigatoriamente @gmail.com) */}
                      <div>
                        <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5 flex items-center justify-between">
                          <span>E-mail para receber o código</span>
                          <span className="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Obrigatoriamente @gmail.com
                          </span>
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                            <Mail className="w-4.5 h-4.5" />
                          </span>
                          <input
                            id="input-forgot-recipient-gmail"
                            type="email"
                            placeholder="ex: seuemail@gmail.com"
                            value={forgotGmail}
                            onChange={(e) => setForgotGmail(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 bg-neutral-900/60 border border-neutral-800 focus:border-[#02c39a]/50 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none transition-colors"
                          />
                        </div>
                        {forgotGmail.trim() && !forgotGmail.toLowerCase().trim().endsWith('@gmail.com') && (
                          <p className="text-[11px] text-amber-300/90 mt-1 flex items-center gap-1 animate-fadeIn">
                            <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
                            <span>O e-mail para receber o código deve terminar obrigatoriamente com <strong>@gmail.com</strong></span>
                          </p>
                        )}
                        <p className="text-[11px] text-neutral-500 mt-1">
                          💡 O código de 6 dígitos será enviado diretamente para este endereço @gmail.com.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgot(false);
                            setForgotStep(1);
                            setResetError('');
                            setForgotGmail('');
                          }}
                          className="py-3 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={forgotLoading || !forgotEmail.trim() || !forgotGmail.trim()}
                          className="py-3 bg-[#02c39a] hover:bg-[#02b18c] disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-[#02c39a]/15"
                        >
                          {forgotLoading ? (
                            <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Enviar Código</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleConfirmResetPassword} noValidate className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                          Código de 6 Dígitos (Recebido por E-mail)
                        </label>
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="000000"
                          value={resetTokenInput}
                          onChange={(e) => setResetTokenInput(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-4 py-3 bg-neutral-900/60 border border-neutral-800 focus:border-[#02c39a]/50 rounded-xl text-lg font-mono tracking-widest text-center text-neutral-100 outline-none font-bold placeholder-neutral-700"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                          Nova Senha (mínimo 6 caracteres)
                        </label>
                        <input
                          type="password"
                          placeholder="Digite a nova senha"
                          value={resetNewPassword}
                          onChange={(e) => setResetNewPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-neutral-900/60 border border-neutral-800 focus:border-[#02c39a]/50 rounded-xl text-sm text-neutral-100 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                          Confirmar Nova Senha
                        </label>
                        <input
                          type="password"
                          placeholder="Repita a nova senha"
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-neutral-900/60 border border-neutral-800 focus:border-[#02c39a]/50 rounded-xl text-sm text-neutral-100 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForgotStep(1);
                            setResetError('');
                          }}
                          className="py-3 bg-neutral-900 hover:bg-neutral-850 text-neutral-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          disabled={forgotLoading || resetTokenInput.length !== 6 || resetNewPassword.length < 6 || resetNewPassword !== resetConfirmPassword}
                          className="py-3 bg-[#02c39a] hover:bg-[#02b18c] disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-[#02c39a]/15"
                        >
                          {forgotLoading ? (
                            <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Redefinir Senha</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-center pt-1">
                        <button
                          type="button"
                          disabled={forgotLoading}
                          onClick={handleRequestResetToken}
                          className="text-xs text-neutral-400 hover:text-[#02c39a] transition-colors underline cursor-pointer disabled:opacity-50"
                        >
                          Não recebeu o código? Reenviar por e-mail
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <>
                  {/* Dynamic Dual-Tab Selector switcher */}
                  <div className="grid grid-cols-2 p-1 bg-neutral-900/60 border border-neutral-800 rounded-xl mb-6">
                    <button
                      id="tab-login-signin"
                      type="button"
                      disabled={isLoading}
                      onClick={() => setActiveTab('signin')}
                      className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        activeTab === 'signin' 
                          ? 'bg-[#02c39a] text-neutral-950 shadow-md' 
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Entrar</span>
                    </button>
                    <button
                      id="tab-login-signup"
                      type="button"
                      disabled={isLoading}
                      onClick={() => setActiveTab('signup')}
                      className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        activeTab === 'signup' 
                          ? 'bg-[#02c39a] text-neutral-950 shadow-md' 
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Cadastrar</span>
                    </button>
                  </div>

                  {/* Success message feedback banner */}
                  {successMsg && (
                    <div className="flex items-center gap-2.5 p-4 bg-[#02c39a]/15 border border-[#02c39a]/30 rounded-xl text-xs text-[#02c39a] mb-4 animate-fadeIn">
                      <CheckCircle className="w-5 h-5 shrink-0" />
                      <span className="leading-relaxed font-medium">{successMsg}</span>
                    </div>
                  )}

                  {/* Form panel */}
                  <form onSubmit={handleSubmit} noValidate className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                        E-mail de Acesso
                      </label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                          <User className="w-4.5 h-4.5" />
                        </span>
                        <input
                          ref={emailInputRef}
                          id="login-email-input"
                          type="email"
                          disabled={isLoading}
                          placeholder="Exemplo: seu-email@email.com"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (error) setError('');
                          }}
                          onBlur={() => setTouchedEmail(true)}
                          className={`w-full pl-11 pr-4 py-3 bg-neutral-900/60 border ${
                            (touchedEmail && !isEmailValid) || (error && (error.toLowerCase().includes('e-mail') || error.toLowerCase().includes('email') || error.toLowerCase().includes('cadastrad')))
                              ? 'border-red-500/80 focus:border-red-500 ring-1 ring-red-500/20' 
                              : 'border-neutral-800 focus:border-[#02c39a]/50 focus:ring-1 focus:ring-[#02c39a]/35'
                          } disabled:opacity-60 disabled:cursor-not-allowed hover:border-neutral-700 transition-all rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none`}
                        />
                      </div>
                      {touchedEmail && !isEmailValid && (
                        <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>Digite um formato de e-mail válido (ex: seu.nome@escola.com)</span>
                        </p>
                      )}
                      {error && (error.toLowerCase().includes('e-mail') || error.toLowerCase().includes('email') || error.toLowerCase().includes('cadastrad')) && (
                        <p className="text-[11px] text-red-400 mt-1.5 flex items-start gap-1.5 animate-fadeIn font-semibold bg-red-950/40 p-2 rounded-lg border border-red-500/30">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{error}</span>
                        </p>
                      )}
                      {touchedEmail && isEmailValid && isLikelyIncompleteDomain && !error && (
                        <p className="text-[11px] text-amber-300/90 mt-1 flex items-center gap-1 animate-fadeIn">
                          <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
                          <span>Aviso: o final parece incompleto. Verifique se o e-mail não termina em <strong>.com</strong> ou <strong>.com.br</strong></span>
                        </p>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase">
                          Senha secreta
                        </label>
                        {activeTab === 'signin' && (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => {
                              setShowForgot(true);
                              setForgotEmail(email);
                              setForgotGmail(email.toLowerCase().trim().endsWith('@gmail.com') ? email.trim() : '');
                              setForgotStep(1);
                              setResetError('');
                            }}
                            className="text-xs text-neutral-500 hover:text-[#02c39a] transition-colors cursor-pointer bg-transparent border-0 outline-none p-0 font-medium disabled:opacity-50"
                          >
                            Esqueceu a senha?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                          <Lock className="w-4.5 h-4.5" />
                        </span>
                        <input
                          id="login-password-input"
                          type="password"
                          disabled={isLoading}
                          placeholder={activeTab === 'signin' ? 'Sua senha secreta' : 'Criar nova senha (mínimo 6 caracteres)'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onBlur={() => setTouchedPassword(true)}
                          className={`w-full pl-11 pr-4 py-3 bg-neutral-900/60 border ${
                            touchedPassword && !isPasswordValid ? 'border-amber-500/60 focus:border-amber-500' : 'border-neutral-800 focus:border-[#02c39a]/50'
                          } disabled:opacity-60 disabled:cursor-not-allowed hover:border-neutral-700 focus:ring-1 focus:ring-[#02c39a]/35 transition-all rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none`}
                        />
                      </div>
                      {touchedPassword && !isPasswordValid && (
                        <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>A senha deve conter no mínimo 6 caracteres</span>
                        </p>
                      )}
                    </div>

                    {/* Confirm password container (only for sign up layout) */}
                    {activeTab === 'signup' && (
                      <>
                        <div className="animate-slideDown">
                          <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                            Confirmar Senha
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                              <Lock className="w-4.5 h-4.5" />
                            </span>
                            <input
                              id="login-confirmpassword-input"
                              type="password"
                              disabled={isLoading}
                              placeholder="Repita sua senha criada"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              onBlur={() => setTouchedConfirm(true)}
                              className={`w-full pl-11 pr-4 py-3 bg-neutral-900/60 border ${
                                touchedConfirm && !isConfirmValid ? 'border-amber-500/60 focus:border-amber-500' : 'border-neutral-800 focus:border-[#02c39a]/50'
                              } disabled:opacity-60 disabled:cursor-not-allowed hover:border-neutral-700 focus:ring-1 focus:ring-[#02c39a]/35 transition-all rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none`}
                            />
                          </div>
                          {touchedConfirm && !isConfirmValid && (
                            <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>As senhas digitadas não coincidem</span>
                            </p>
                          )}
                        </div>

                        {/* Generic school input only for teachers */}
                        {!isStudent && (
                          <div className="animate-slideDown">
                            <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                              Escola / Instituição de Ensino
                            </label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                                <Building2 className="w-4.5 h-4.5" />
                              </span>
                              <input
                                id="signup-escola-input"
                                type="text"
                                disabled={isLoading}
                                placeholder="Ex: Colégio Athenas, E.E. Mário Quintana..."
                                value={escola}
                                onChange={(e) => setEscola(e.target.value)}
                                onBlur={() => setTouchedEscola(true)}
                                className={`w-full pl-11 pr-4 py-3 bg-neutral-900/60 border ${
                                  touchedEscola && !isEscolaValid ? 'border-amber-500/60 focus:border-amber-500' : 'border-neutral-800 focus:border-[#02c39a]/50'
                                } disabled:opacity-60 disabled:cursor-not-allowed hover:border-neutral-700 focus:ring-1 focus:ring-[#02c39a]/35 transition-all rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none`}
                              />
                            </div>
                            {touchedEscola && !isEscolaValid && (
                              <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span>Informe o nome da sua escola ou colégio</span>
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* Student fields */}
                    {isStudent && activeTab === 'signup' && (
                      <div className="space-y-4 animate-slideDown">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                            Nome Completo do Aluno
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                              <User className="w-4.5 h-4.5" />
                            </span>
                            <input
                              id="signup-nome-aluno-input"
                              type="text"
                              disabled={isLoading}
                              placeholder="Ex: Pedro Henrique"
                              value={nomeAluno}
                              onChange={(e) => setNomeAluno(e.target.value)}
                              onBlur={() => setTouchedNomeAluno(true)}
                              className={`w-full pl-11 pr-4 py-3 bg-neutral-900/60 border ${
                                touchedNomeAluno && !nomeAluno.trim() ? 'border-amber-500/60 focus:border-amber-500' : 'border-neutral-800 focus:border-[#02c39a]/50'
                              } disabled:opacity-60 disabled:cursor-not-allowed hover:border-neutral-700 focus:ring-1 focus:ring-[#02c39a]/35 transition-all rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none`}
                            />
                          </div>
                          {touchedNomeAluno && !nomeAluno.trim() && (
                            <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>Nome completo é obrigatório</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                            Nº de Chamada (Lista de Presença)
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                              <Hash className="w-4.5 h-4.5" />
                            </span>
                            <input
                              id="signup-chamada-input"
                              type="number"
                              disabled={isLoading}
                              placeholder="Ex: 12"
                              value={numeroChamada}
                              onChange={(e) => setNumeroChamada(e.target.value)}
                              onBlur={() => setTouchedChamada(true)}
                              className={`w-full pl-11 pr-4 py-3 bg-neutral-900/60 border ${
                                touchedChamada && (!numeroChamada || parseInt(numeroChamada) <= 0) ? 'border-amber-500/60 focus:border-amber-500' : 'border-neutral-800 focus:border-[#02c39a]/50'
                              } disabled:opacity-60 disabled:cursor-not-allowed hover:border-neutral-700 focus:ring-1 focus:ring-[#02c39a]/35 transition-all rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none`}
                            />
                          </div>
                          {touchedChamada && (!numeroChamada || parseInt(numeroChamada) <= 0) && (
                            <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                              <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                              <span>Informe seu número de chamada (maior que 0)</span>
                            </p>
                          )}
                        </div>

                        {/* Localização & Escola do Aluno */}
                        <div className="pt-2 border-t border-neutral-800/80 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                              Onde você estuda?
                            </span>
                          </div>

                          {/* 1. Estado onde estuda (UF) */}
                          <div>
                            <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                                Estado onde estuda (UF)
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">27 UFs do Brasil</span>
                            </label>
                            <select
                              id="signup-estado-select"
                              disabled={isLoading}
                              value={estado}
                              onChange={(e) => {
                                setEstado(e.target.value);
                                setTouchedEstado(true);
                              }}
                              className={`w-full px-4 py-3 bg-neutral-900/80 border ${
                                touchedEstado && !estado ? 'border-amber-500/60' : 'border-neutral-800 focus:border-[#02c39a]/50'
                              } focus:ring-1 focus:ring-[#02c39a]/35 rounded-xl text-sm text-neutral-100 outline-none cursor-pointer`}
                            >
                              <option value="">Selecione seu Estado (UF)...</option>
                              {BRAZILIAN_STATES.map((st) => (
                                <option key={st.sigla} value={st.sigla} className="bg-neutral-900 text-neutral-100">
                                  {st.nome} ({st.sigla})
                                </option>
                              ))}
                            </select>
                            {touchedEstado && !estado && (
                              <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                                <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                <span>Selecione o estado em que estuda</span>
                              </p>
                            )}
                          </div>

                          {/* 2. Cidade onde estuda (IBGE) */}
                          {estado && (
                            <div className="relative animate-fadeIn">
                              <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                                  Cidade onde estuda
                                </span>
                                {loadingCidades && (
                                  <span className="text-[10px] text-emerald-400 font-mono animate-pulse">Carregando municípios...</span>
                                )}
                              </label>
                              <div className="relative">
                                <input
                                  id="signup-cidade-input"
                                  type="text"
                                  disabled={isLoading || loadingCidades}
                                  placeholder={loadingCidades ? "Carregando municípios..." : "Digite o nome da sua cidade..."}
                                  value={cidadeSearch || cidade}
                                  onChange={(e) => {
                                    setCidadeSearch(e.target.value);
                                    setCidade('');
                                    setIsCidadeDropdownOpen(true);
                                    setTouchedCidade(true);
                                  }}
                                  onFocus={() => setIsCidadeDropdownOpen(true)}
                                  className={`w-full pl-10 pr-4 py-3 bg-neutral-900/80 border ${
                                    touchedCidade && !cidade ? 'border-amber-500/60' : 'border-neutral-800 focus:border-[#02c39a]/50'
                                  } focus:ring-1 focus:ring-[#02c39a]/35 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none`}
                                />
                                <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
                              </div>

                              {/* Dropdown with filtered cities from IBGE */}
                              {isCidadeDropdownOpen && cidadesList.length > 0 && (
                                <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl p-1 space-y-0.5 custom-scrollbar">
                                  {cidadesList
                                    .filter(c => !cidadeSearch || c.toLowerCase().includes(cidadeSearch.toLowerCase()))
                                    .slice(0, 50)
                                    .map(c => (
                                      <button
                                        key={c}
                                        type="button"
                                        onClick={() => {
                                          setCidade(c);
                                          setCidadeSearch(c);
                                          setIsCidadeDropdownOpen(false);
                                          setSchoolSelected(null);
                                          setEscola('');
                                          setEscolaSearchQuery('');
                                        }}
                                        className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                                          cidade === c ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-neutral-200 hover:bg-neutral-800'
                                        }`}
                                      >
                                        <span>{c}</span>
                                        {cidade === c && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                                      </button>
                                    ))}
                                </div>
                              )}
                              {touchedCidade && !cidade && (
                                <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                                  <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                                  <span>Escolha sua cidade na lista</span>
                                </p>
                              )}
                            </div>
                          )}

                          {/* 3. Escola onde estuda */}
                          {cidade && (
                            <div className="relative animate-fadeIn space-y-2">
                              <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                                  Escola / Colégio
                                </span>
                              </label>

                              {schoolSelected ? (
                                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3 animate-fadeIn">
                                  <div className="flex items-start gap-2.5 min-w-0">
                                    <div className="p-2 bg-emerald-500/20 rounded-xl text-emerald-400 shrink-0 mt-0.5">
                                      <CheckCircle className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-neutral-100 truncate">{schoolSelected.nome}</p>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {schoolSelected.codigoInep && schoolSelected.codigoInep !== 'Não informado' && (
                                          <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                            Cód: {schoolSelected.codigoInep}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-neutral-400">
                                          Rede {schoolSelected.rede} • {cidade}/{estado}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSchoolSelected(null);
                                      setEscola('');
                                      setEscolaSearchQuery('');
                                      setIsEscolaDropdownOpen(true);
                                    }}
                                    className="text-xs text-neutral-400 hover:text-emerald-300 font-semibold px-2 py-1 rounded-lg hover:bg-neutral-800 transition-colors shrink-0 cursor-pointer underline"
                                  >
                                    Trocar
                                  </button>
                                </div>
                              ) : (
                                <div className="relative">
                                  <div className="relative">
                                    <input
                                      id="signup-escola-search-input"
                                      type="text"
                                      disabled={isLoading}
                                      placeholder="Digite o nome da sua escola para buscar..."
                                      value={escolaSearchQuery}
                                      onChange={(e) => {
                                        setEscolaSearchQuery(e.target.value);
                                        setIsEscolaDropdownOpen(true);
                                      }}
                                      onFocus={() => setIsEscolaDropdownOpen(true)}
                                      className="w-full pl-10 pr-10 py-3 bg-neutral-900/80 border border-neutral-800 focus:border-[#02c39a]/50 rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none"
                                    />
                                    <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
                                    {loadingInep && (
                                      <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin absolute right-3.5 top-3.5" />
                                    )}
                                  </div>

                                  {/* Dropdown with school options */}
                                  {isEscolaDropdownOpen && (
                                    <div className="absolute z-40 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-2xl shadow-2xl p-2 space-y-1.5 custom-scrollbar">
                                      <div className="px-2 py-1 flex items-center justify-between text-[10px] text-neutral-400 border-b border-neutral-800 pb-1.5 mb-1 font-mono">
                                        <span>Escolas encontradas ({cidade} - {estado}):</span>
                                        {inepSchools.length > 0 && <span className="text-emerald-400 font-bold">{inepSchools.length} escolas</span>}
                                      </div>

                                      {loadingInep ? (
                                        <div className="py-6 text-center text-xs text-neutral-400 flex flex-col items-center gap-2">
                                          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                          <span>Buscando escolas disponíveis...</span>
                                        </div>
                                      ) : inepSchools.length > 0 ? (
                                        inepSchools.map((sch) => (
                                          <button
                                            key={sch.id || sch.codigoInep}
                                            type="button"
                                            onClick={() => handleSelectInepSchool(sch)}
                                            className="w-full text-left p-2.5 rounded-xl bg-neutral-850/60 hover:bg-neutral-800 border border-neutral-800 hover:border-emerald-500/40 transition-all cursor-pointer group"
                                          >
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="text-xs font-bold text-neutral-100 group-hover:text-emerald-300 transition-colors leading-snug">
                                                {sch.nome}
                                              </p>
                                              {sch.codigoInep && sch.codigoInep !== 'Não informado' && (
                                                <span className="text-[9.5px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 shrink-0">
                                                  Cód: {sch.codigoInep}
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 text-[10.5px] text-neutral-400">
                                              <span className="px-1.5 py-0.2 bg-neutral-800 text-neutral-300 rounded text-[9.5px]">
                                                Rede {sch.rede}
                                              </span>
                                              {sch.bairro && <span className="truncate">• {sch.bairro}</span>}
                                              {sch.etapas && <span className="truncate text-neutral-500">• {sch.etapas}</span>}
                                            </div>
                                          </button>
                                        ))
                                      ) : (
                                        <div className="py-4 text-center text-xs text-neutral-400">
                                          <p>Nenhuma escola com este nome encontrada em {cidade}.</p>
                                        </div>
                                      )}

                                      {/* Option to use custom typed school name */}
                                      {escolaSearchQuery.trim().length > 0 && (
                                        <div className="pt-1.5 border-t border-neutral-800/80 mt-1">
                                          <button
                                            type="button"
                                            onClick={handleUseCustomSchool}
                                            className="w-full text-left px-3 py-2 text-xs rounded-xl bg-neutral-800/40 hover:bg-neutral-800 text-emerald-400 hover:text-emerald-300 transition-colors flex items-center justify-between cursor-pointer font-medium"
                                          >
                                            <span>Não encontrou? Usar: <strong>"{escolaSearchQuery.trim()}"</strong></span>
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="p-3.5 bg-neutral-900/80 border border-neutral-800 rounded-2xl text-[11px] text-neutral-300 space-y-1 mt-2">
                          <p className="font-bold flex items-center gap-1.5 text-emerald-400 text-xs">
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                            Segurança e Confidencialidade
                          </p>
                          <p className="leading-relaxed text-neutral-400">
                            Suas credenciais são de uso estritamente pessoal. A plataforma oferece recuperação assistida por token único caso precise redefinir sua senha no futuro.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Teacher fields */}
                    {!isStudent && activeTab === 'signup' && (
                      <div className="space-y-4 animate-slideDown">
                        <div>
                          <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                            Nome Completo do Docente
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                              <User className="w-4.5 h-4.5" />
                            </span>
                            <input
                              id="signup-nome-prof-input"
                              type="text"
                              disabled={isLoading}
                              placeholder="Ex: Carlos Eduardo"
                              value={nomeProfessor}
                              onChange={(e) => setNomeProfessor(e.target.value)}
                              onBlur={() => setTouchedNomeProf(true)}
                              className={`w-full pl-11 pr-4 py-3 bg-neutral-900/60 border ${
                                touchedNomeProf && !nomeProfessor.trim() ? 'border-amber-500/60 focus:border-amber-500' : 'border-neutral-800 focus:border-[#02c39a]/50'
                              } disabled:opacity-60 disabled:cursor-not-allowed hover:border-neutral-700 focus:ring-1 focus:ring-[#02c39a]/35 transition-all rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none`}
                            />
                          </div>
                          {touchedNomeProf && !nomeProfessor.trim() && (
                            <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>Nome do docente é obrigatório</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-1.5">
                            Matéria / Disciplina
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                              <BookOpen className="w-4.5 h-4.5" />
                            </span>
                            <input
                              id="signup-materia-prof-input"
                              type="text"
                              disabled={isLoading}
                              placeholder="Ex: Matemática, Ciências, História..."
                              value={materiaProfessor}
                              onChange={(e) => setMateriaProfessor(e.target.value)}
                              onBlur={() => setTouchedMateriaProf(true)}
                              className={`w-full pl-11 pr-4 py-3 bg-neutral-900/60 border ${
                                touchedMateriaProf && !materiaProfessor.trim() ? 'border-amber-500/60 focus:border-amber-500' : 'border-neutral-800 focus:border-[#02c39a]/50'
                              } disabled:opacity-60 disabled:cursor-not-allowed hover:border-neutral-700 focus:ring-1 focus:ring-[#02c39a]/35 transition-all rounded-xl text-sm text-neutral-100 placeholder-neutral-600 outline-none`}
                            />
                          </div>
                          {touchedMateriaProf && !materiaProfessor.trim() && (
                            <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1 animate-fadeIn">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>Disciplina é obrigatória</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Error message banner - Persistent with clear actions, positioned directly above submit button for instant visibility */}
                    {error && (
                      <div ref={errorRef} className="flex flex-col gap-2.5 p-4 bg-red-950/80 border-2 border-red-500/60 rounded-2xl text-xs text-red-200 mt-4 shadow-xl animate-fadeIn">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                          <div className="flex-1 leading-relaxed">
                            <span className="font-extrabold text-red-100 text-sm block mb-1">
                              {activeTab === 'signin' ? 'Atenção ao entrar' : 'Atenção ao cadastrar'}
                            </span>
                            <span className="text-red-200/90 text-xs leading-relaxed block">{error}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-red-500/25 mt-1">
                          {activeTab === 'signin' && (
                            <button
                              type="button"
                              onClick={() => setActiveTab('signup')}
                              className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg font-semibold text-[11px] transition-all cursor-pointer"
                            >
                              Criar uma conta
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              setError('');
                              handleSubmit(e as any);
                            }}
                            disabled={isLoading}
                            className="px-3 py-1 bg-red-500/25 hover:bg-red-500/35 text-red-100 border border-red-500/50 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Tentar Novamente</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      id="btn-login-submit"
                      type="submit"
                      disabled={!isFormValid || isLoading}
                      className="w-full mt-6 py-3.5 bg-[#02c39a] hover:bg-[#02b18c] disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-extrabold rounded-xl transition-all shadow-lg hover:shadow-[#02c39a]/20 flex items-center justify-center gap-2 text-sm cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin shrink-0" />
                          <span>{activeTab === 'signin' ? 'Verificando credenciais e acessando...' : 'Criando perfil e registrando...'}</span>
                        </>
                      ) : (
                        <>
                          {activeTab === 'signin' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          <span>{activeTab === 'signin' ? 'Acessar Plataforma' : 'Registrar Conta'}</span>
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          {/* Lado da Imagem com cantos arredondados */}
          <div className="hidden md:block md:col-span-6 p-4">
            <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-neutral-800/40">
              <img
                src="https://i.ibb.co/dsNgMZMN/2.jpg"
                alt="Arte Athenas"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover select-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-neutral-950/20 to-transparent pointer-events-none" />
              <div className="absolute bottom-6 left-6 right-6 text-left z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-950/60 border border-white/10 text-[#02c39a] rounded-full text-[10px] font-mono font-medium mb-2.5 backdrop-blur-md">
                  <Sparkles className="w-3 h-3 text-[#02c39a]" />
                  Ambiente de Aprendizagem Inteligente
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight font-display">Athenas Plataforma</h3>
                <p className="text-neutral-300 text-xs mt-1 leading-relaxed">Conectando saberes, expandindo possibilidades e construindo o futuro da educação de forma ativa.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
