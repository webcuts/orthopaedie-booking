-- =====================================================
-- ORTHO-030: Russisch (RU) und Arabisch (AR) Übersetzungen
-- Neue Spalten + Übersetzungsdaten für alle mehrsprachigen Tabellen
-- =====================================================

-- =====================================================
-- 1. Neue Spalten: treatment_types
-- =====================================================

ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS description_ru TEXT;
ALTER TABLE treatment_types ADD COLUMN IF NOT EXISTS description_ar TEXT;

-- =====================================================
-- 2. Neue Spalten: insurance_types
-- =====================================================

ALTER TABLE insurance_types ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE insurance_types ADD COLUMN IF NOT EXISTS name_ar TEXT;

-- =====================================================
-- 3. Neue Spalten: specialties
-- =====================================================

ALTER TABLE specialties ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE specialties ADD COLUMN IF NOT EXISTS name_ar TEXT;

-- =====================================================
-- 4. Neue Spalten: mfa_treatment_types
-- =====================================================

ALTER TABLE mfa_treatment_types ADD COLUMN IF NOT EXISTS name_ru TEXT;
ALTER TABLE mfa_treatment_types ADD COLUMN IF NOT EXISTS name_ar TEXT;

-- =====================================================
-- 5. Übersetzungen: treatment_types
-- =====================================================

UPDATE treatment_types SET
  name_ru = CASE name
    WHEN 'Erstuntersuchung Neupatient' THEN 'Первичный осмотр (новый пациент)'
    WHEN 'Sprechstunde' THEN 'Консультация'
    WHEN 'Rezepte' THEN 'Рецепты'
    WHEN 'Erstberatung' THEN 'Первичная консультация'
    WHEN 'Kontrolluntersuchung' THEN 'Контрольный осмотр'
    WHEN 'Manuelle Therapie' THEN 'Мануальная терапия'
    WHEN 'Röntgenbesprechung' THEN 'Обсуждение рентгена'
    WHEN 'Injektionstherapie' THEN 'Инъекционная терапия'
    WHEN 'Stoßwellentherapie' THEN 'Ударно-волновая терапия'
    ELSE name
  END,
  name_ar = CASE name
    WHEN 'Erstuntersuchung Neupatient' THEN 'الفحص الأولي (مريض جديد)'
    WHEN 'Sprechstunde' THEN 'استشارة'
    WHEN 'Rezepte' THEN 'وصفات طبية'
    WHEN 'Erstberatung' THEN 'الاستشارة الأولية'
    WHEN 'Kontrolluntersuchung' THEN 'فحص المتابعة'
    WHEN 'Manuelle Therapie' THEN 'العلاج اليدوي'
    WHEN 'Röntgenbesprechung' THEN 'مناقشة الأشعة'
    WHEN 'Injektionstherapie' THEN 'العلاج بالحقن'
    WHEN 'Stoßwellentherapie' THEN 'العلاج بالموجات الصادمة'
    ELSE name
  END;

-- Beschreibungen
UPDATE treatment_types SET
  description_ru = CASE description
    WHEN 'Ersttermin für neue Patienten' THEN 'Первый приём для новых пациентов'
    WHEN 'Kontrolltermin für Bestandspatienten' THEN 'Контрольный приём для постоянных пациентов'
    WHEN 'Rezeptabholung' THEN 'Получение рецепта'
    WHEN 'Extrakorporale Stoßwellentherapie' THEN 'Экстракорпоральная ударно-волновая терапия'
    ELSE description
  END,
  description_ar = CASE description
    WHEN 'Ersttermin für neue Patienten' THEN 'أول موعد للمرضى الجدد'
    WHEN 'Kontrolltermin für Bestandspatienten' THEN 'موعد متابعة للمرضى الحاليين'
    WHEN 'Rezeptabholung' THEN 'استلام الوصفة الطبية'
    WHEN 'Extrakorporale Stoßwellentherapie' THEN 'العلاج بالموجات الصادمة خارج الجسم'
    ELSE description
  END
WHERE description IS NOT NULL;

-- =====================================================
-- 6. Übersetzungen: insurance_types
-- =====================================================

UPDATE insurance_types SET
  name_ru = CASE name
    WHEN 'Gesetzlich versichert' THEN 'Государственное страхование'
    WHEN 'Privat versichert' THEN 'Частное страхование'
    WHEN 'Selbstzahler' THEN 'Самоплательщик'
    ELSE name
  END,
  name_ar = CASE name
    WHEN 'Gesetzlich versichert' THEN 'تأمين حكومي'
    WHEN 'Privat versichert' THEN 'تأمين خاص'
    WHEN 'Selbstzahler' THEN 'دفع ذاتي'
    ELSE name
  END;

-- =====================================================
-- 7. Übersetzungen: specialties
-- =====================================================

UPDATE specialties SET
  name_ru = CASE name
    WHEN 'Orthopäde und Unfallchirurg' THEN 'Ортопедия и травматология'
    WHEN 'Physikalischer und Rehabilitativer Mediziner' THEN 'Физическая и реабилитационная медицина'
    ELSE name
  END,
  name_ar = CASE name
    WHEN 'Orthopäde und Unfallchirurg' THEN 'جراحة العظام والحوادث'
    WHEN 'Physikalischer und Rehabilitativer Mediziner' THEN 'الطب الطبيعي والتأهيلي'
    ELSE name
  END;

-- =====================================================
-- 8. Übersetzungen: mfa_treatment_types
-- =====================================================

UPDATE mfa_treatment_types SET
  name_ru = CASE name
    WHEN 'Rezeptvergabe' THEN 'Выписка рецепта'
    WHEN 'Medikamente' THEN 'Лекарства'
    WHEN 'Physiotherapie-Überweisung' THEN 'Направление на физиотерапию'
    WHEN 'PRP-Behandlung' THEN 'PRP-терапия'
    WHEN 'Hyaluronsäure-Behandlung' THEN 'Терапия гиалуроновой кислотой'
    WHEN 'Knochendichte-Messung' THEN 'Измерение плотности костей'
    ELSE name
  END,
  name_ar = CASE name
    WHEN 'Rezeptvergabe' THEN 'وصفة طبية'
    WHEN 'Medikamente' THEN 'أدوية'
    WHEN 'Physiotherapie-Überweisung' THEN 'إحالة للعلاج الطبيعي'
    WHEN 'PRP-Behandlung' THEN 'علاج PRP'
    WHEN 'Hyaluronsäure-Behandlung' THEN 'علاج حمض الهيالورونيك'
    WHEN 'Knochendichte-Messung' THEN 'قياس كثافة العظام'
    ELSE name
  END;
