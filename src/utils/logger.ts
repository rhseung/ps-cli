import chalk from 'chalk';
import gradient from 'gradient-string';

import { icons } from './icons';

export const colors = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  info: '#5AC8FA',
  gray: '#8E8E93',
};

export const psGradient = gradient([colors.primary, colors.secondary]);

export const logger = {
  error(message: string, ...args: unknown[]) {
    console.error(
      `${chalk.hex(colors.error)(icons.error)} ${chalk.bold.hex(colors.error)('오류:')} ${message}`,
      ...args,
    );
  },

  warn(message: string, ...args: unknown[]) {
    console.warn(
      `${chalk.hex(colors.warning)(icons.warning)} ${chalk.bold.hex(colors.warning)('경고:')} ${message}`,
      ...args,
    );
  },

  success(message: string, ...args: unknown[]) {
    console.log(
      `${chalk.hex(colors.success)(icons.success)} ${chalk.bold.hex(colors.success)('성공:')} ${message}`,
      ...args,
    );
  },

  info(message: string, ...args: unknown[]) {
    console.log(
      `${chalk.hex(colors.info)(icons.info)} ${chalk.bold.hex(colors.info)('정보:')} ${message}`,
      ...args,
    );
  },

  tip(message: string, ...args: unknown[]) {
    console.log(
      `${chalk.hex(colors.primary)(icons.tip)} ${chalk.bold.hex(colors.primary)('팁:')} ${message}`,
      ...args,
    );
  },

  ps(message: string) {
    console.log(psGradient.multiline(message));
  },

  bold: chalk.bold,
  dim: chalk.dim,
  italic: chalk.italic,
  hex: chalk.hex,
};
