import { render } from 'ink';
import React from 'react';

import type { CommandFlags } from '../types/command';

/**
 * 모든 Command 클래스의 베이스 클래스
 * 공통 기능과 패턴을 제공합니다.
 * @template TFlags - 명령어별 플래그 타입 (기본값: CommandFlags)
 */
export abstract class Command<TFlags extends CommandFlags = CommandFlags> {
  /**
   * 명령어 실행 메서드 (추상 메서드)
   * 각 Command 클래스에서 구현해야 합니다.
   */
  abstract execute(args: string[], flags: TFlags): Promise<void> | void;

  /**
   * 뷰 렌더링 헬퍼 메서드
   * React 컴포넌트를 렌더링하고 완료 시 정리합니다.
   * @param Component - 렌더링할 React 컴포넌트 (함수 컴포넌트 또는 클래스 필드로 정의된 화살표 함수)
   * @param props - 컴포넌트에 전달할 props (onComplete는 자동으로 추가됨)
   */
  protected async renderView<TProps extends { onComplete?: () => void }>(
    Component:
      | React.ComponentType<TProps>
      | ((props: TProps) => React.ReactElement),
    props: Omit<TProps, 'onComplete'>,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const componentProps = {
        ...props,
        onComplete: () => {
          resolve();
        },
      } as TProps;
      const { unmount } = render(<Component {...componentProps} />);
      // resolve 시 unmount도 함께 처리
      const originalResolve = resolve;
      resolve = () => {
        unmount();
        originalResolve();
      };
    });
  }
}
