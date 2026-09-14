import React from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Controller, Control, FieldErrors } from 'react-hook-form'
import { colors } from '../../constants/colors'
import { fonts } from '../../constants/fonts'
import { spacing } from '../../constants/spacing'
import { radius } from '../../constants/radius'
import { AuthFormValues } from './authFormTypes'

type Props = {
  control: Control<AuthFormValues>
  errors: FieldErrors<AuthFormValues>
  mode: 'login' | 'signup'
}

// Componente puramente presentacional: no tiene useState propio para los
// valores del formulario — lee y escribe todo a través de `control`, que
// vive en el padre (app/auth/index.tsx). Así el padre administra los datos
// (useForm) y este componente sólo los renderiza/emite cambios vía Controller.
export default function AuthFormFields({ control, errors, mode }: Props) {
  return (
    <>
      {mode === 'signup' && (
        <>
          <Text style={styles.label}>Usuario</Text>
          <Controller
            control={control}
            name="username"
            rules={{
              required: 'El nombre de usuario es obligatorio',
              minLength: { value: 3, message: 'El usuario debe tener al menos 3 caracteres' },
              pattern: {
                value: /^[a-z0-9._]+$/,
                message: 'Solo se permiten letras, números, puntos y guiones bajos',
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, !!errors.username && styles.inputError]}
                placeholder="tu_usuario"
                placeholderTextColor={colors.grisMedio}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          />
          {errors.username && <Text style={styles.fieldError}>{errors.username.message}</Text>}

          <Text style={styles.label}>Nombre</Text>
          <Controller
            control={control}
            name="displayName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={styles.input}
                placeholder="Tu nombre (opcional)"
                placeholderTextColor={colors.grisMedio}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </>
      )}

      <Text style={styles.label}>Email</Text>
      <Controller
        control={control}
        name="email"
        rules={{
          required: 'El email es obligatorio',
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Ingresá un email válido',
          },
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[styles.input, !!errors.email && styles.inputError]}
            placeholder="tu@email.com"
            placeholderTextColor={colors.grisMedio}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
      />
      {errors.email && <Text style={styles.fieldError}>{errors.email.message}</Text>}

      <Text style={styles.label}>Contraseña</Text>
      <Controller
        control={control}
        name="password"
        rules={{
          required: 'La contraseña es obligatoria',
          // El mínimo de 8 caracteres sólo se exige al registrarse — cuentas
          // ya existentes (seed) pueden tener passwords más cortas y no hay
          // que bloquearles el login por una regla que se agregó después.
          minLength: mode === 'signup'
            ? { value: 8, message: 'La contraseña debe tener al menos 8 caracteres' }
            : undefined,
        }}
        render={({ field: { onChange, onBlur, value } }) => (
          <TextInput
            style={[styles.input, !!errors.password && styles.inputError]}
            placeholder={mode === 'signup' ? 'Mínimo 8 caracteres' : '••••••••'}
            placeholderTextColor={colors.grisMedio}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
          />
        )}
      />
      {errors.password && <Text style={styles.fieldError}>{errors.password.message}</Text>}

      {mode === 'signup' && (
        <>
          <Controller
            control={control}
            name="acceptTerms"
            rules={{ validate: (value) => value === true || 'Debés aceptar los términos y condiciones' }}
            render={({ field: { onChange, value } }) => (
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => onChange(!value)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, value && styles.checkboxChecked]}>
                  {value && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>
                  Acepto los términos y condiciones de uso de OPA
                </Text>
              </TouchableOpacity>
            )}
          />
          {errors.acceptTerms && <Text style={styles.fieldError}>{errors.acceptTerms.message}</Text>}
        </>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    color: colors.grisOscuro,
    fontFamily: fonts.mergeOne,
    marginTop: spacing.md,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.grisBorde,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.negro,
    backgroundColor: colors.blanco,
  },
  inputError: {
    borderColor: '#E53935',
  },
  fieldError: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 2,
    marginLeft: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.grisMedio,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blanco,
  },
  checkboxChecked: {
    backgroundColor: colors.rosaOpa,
    borderColor: colors.rosaOpa,
  },
  checkboxMark: {
    color: colors.blanco,
    fontSize: 13,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.grisOscuro,
  },
})
