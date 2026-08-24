import { describe, it, expect } from 'vitest';
import { validateDto } from '#lib/validation/validate-dto.js';
import {
  UpdateVoiceXPConfigDto,
  VoiceLevelCurveType,
} from '#lib/dtos/voice-xp/update-voice-xp-config.dto.js';

describe('UpdateVoiceXPConfigDto', () => {
  it('accepts FORMULA and TABLE curve types', async () => {
    const formulaResult = await validateDto(UpdateVoiceXPConfigDto, {
      levelCurveType: VoiceLevelCurveType.FORMULA,
    });
    const tableResult = await validateDto(UpdateVoiceXPConfigDto, {
      levelCurveType: VoiceLevelCurveType.TABLE,
    });

    expect(formulaResult.success).toBe(true);
    expect(tableResult.success).toBe(true);
  });

  it('accepts an empty threshold list for formula curves', async () => {
    const result = await validateDto(UpdateVoiceXPConfigDto, {
      levelCurveType: VoiceLevelCurveType.FORMULA,
      tableThresholds: [],
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty threshold list for table curves', async () => {
    const result = await validateDto(UpdateVoiceXPConfigDto, {
      levelCurveType: VoiceLevelCurveType.TABLE,
      tableThresholds: [],
    });

    expect(result.success).toBe(false);
    expect(result.errors?.some((error) => error.field === 'tableThresholds')).toBe(true);
  });

  it('accepts legacy curve type values for backward compatibility', async () => {
    const legacyTypes: Array<keyof typeof VoiceLevelCurveType> = [
      'LINEAR',
      'EXPONENTIAL',
      'LOGARITHMIC',
    ];

    for (const legacyType of legacyTypes) {
      const result = await validateDto(UpdateVoiceXPConfigDto, {
        levelCurveType: VoiceLevelCurveType[legacyType],
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts valid anti-farm dampening settings', async () => {
    const result = await validateDto(UpdateVoiceXPConfigDto, {
      antiFarmDampeningEnabled: true,
      antiFarmDampeningMultiplier: 0.35,
      antiFarmMinimumParticipants: 2,
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid anti-farm dampening settings', async () => {
    const result = await validateDto(UpdateVoiceXPConfigDto, {
      antiFarmDampeningMultiplier: 1.2,
      antiFarmMinimumParticipants: 0,
    });

    expect(result.success).toBe(false);
    expect(result.errors?.some((error) => error.field === 'antiFarmDampeningMultiplier')).toBe(true);
    expect(result.errors?.some((error) => error.field === 'antiFarmMinimumParticipants')).toBe(true);
  });
});
