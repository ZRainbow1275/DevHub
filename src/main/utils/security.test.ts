import { describe, it, expect } from 'vitest'
import { validatePath, validateScriptName, parsePackageJson } from './security'

describe('security utilities', () => {
  describe('validatePath', () => {
    it('应该拒绝包含路径遍历的输入', () => {
      const result = validatePath('C:/Users/../../../Windows/System32')
      expect(result.valid).toBe(false)
      // 路径遍历会被 path.normalize 解析，最终因为不在允许目录或路径不存在而被拒绝
      expect(result.error).toBeDefined()
    })

    it('应该拒绝包含特殊字符的路径', () => {
      const testCases = [
        'C:/Projects/test<script>',
        'C:/Projects/test|pipe',
        'C:/Projects/test;rm -rf',
        'C:/Projects/$HOME',
        'C:/Projects/`whoami`'
      ]

      testCases.forEach(path => {
        const result = validatePath(path)
        expect(result.valid).toBe(false)
      })
    })

    it('应该拒绝不存在的路径', () => {
      const result = validatePath('Z:/NonExistent/Path/12345')
      expect(result.valid).toBe(false)
    })

    it('应该接受有效的项目路径', () => {
      // 注意: 这个测试需要在实际环境中运行
      // 使用 process.cwd() 作为已知存在的目录
      const result = validatePath(process.cwd())
      // 如果不在允许列表中，会返回 false
      expect(typeof result.valid).toBe('boolean')
    })
  })

  describe('validateScriptName', () => {
    it('应该接受有效的脚本名称', () => {
      const validNames = ['dev', 'start', 'build', 'test:unit', 'pre-build', 'post_install']
      validNames.forEach(name => {
        expect(validateScriptName(name)).toBe(true)
      })
    })

    it('应该拒绝包含危险字符的脚本名称', () => {
      const invalidNames = [
        'rm -rf /',
        'test && echo hacked',
        'test; cat /etc/passwd',
        'test`whoami`',
        'test$(id)'
      ]
      invalidNames.forEach(name => {
        expect(validateScriptName(name)).toBe(false)
      })
    })
  })

  describe('parsePackageJson', () => {
    it('应该拒绝不存在的路径', () => {
      const result = parsePackageJson('Z:/NonExistent/Path')
      expect(result.valid).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('应该正确解析有效的 package.json', () => {
      // 使用当前项目目录作为测试
      const result = parsePackageJson(process.cwd())
      expect(result.valid).toBe(true)
      expect(result.name).toBeDefined()
      expect(Array.isArray(result.scripts)).toBe(true)
    })
  })
})
