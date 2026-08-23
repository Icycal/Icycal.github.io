const sectionHelp = [
  [/^LOAD\b/i, '可加载段（PT_LOAD）', 'ELF 程序头定义的加载单元。操作系统或动态加载器会把它对应的文件内容映射到进程虚拟地址空间，并按 R/W/X 权限保护。'],
  [/^FLASH\b/i, '非易失存储区域', '通常用于保存代码、常量和已初始化数据的加载镜像。掉电后内容仍然保留，容量由芯片或链接脚本定义。'],
  [/^RAM\b/i, '运行时可写内存区域', '程序运行时保存变量、BSS、堆和栈等内容。掉电后数据消失，容量由芯片或链接脚本定义。'],
  [/^\.text(?:\.|$)/i, '代码区', '保存编译后的机器指令，通常可读、可执行但不可写。函数符号大多位于这里。'],
  [/^\.(?:rodata|rdata)(?:\.|$)/i, '只读数据区', '保存字符串常量、const 数据和只读查找表，运行时通常可读但不可写。'],
  [/^\.data(?:\.|$)/i, '已初始化静态数据区', '保存具有非零初始值的全局变量和静态变量。初始内容存在于文件中，加载后占用可写内存。'],
  [/^\.(?:bss|sbss)(?:\.|$)/i, '零初始化静态数据区', '保存未显式初始化或初始值为零的全局变量和静态变量。通常不占用 ELF 文件数据空间，但运行时会占用内存并清零。'],
  [/^\.(?:tdata)(?:\.|$)/i, '线程局部初始化数据', '保存具有初始值的 TLS 变量。每个线程运行时都会获得自己的独立副本。'],
  [/^\.(?:tbss)(?:\.|$)/i, '线程局部零初始化数据', '保存零初始化 TLS 变量。它不使用普通的模块基址加偏移寻址，需要线程指针参与换算。'],
  [/^\.init_array(?:\.|$)/i, '初始化函数表', '保存进程或共享库加载时需要依次调用的构造函数地址。'],
  [/^\.fini_array(?:\.|$)/i, '析构函数表', '保存进程或共享库卸载、退出时调用的析构函数地址。'],
  [/^\.(?:plt|plt\.got|plt\.sec)(?:\.|$)/i, '过程链接表（PLT）', '动态链接函数调用的跳板区域，通常与 GOT 配合完成外部函数的延迟或立即绑定。'],
  [/^\.(?:got|got\.plt)(?:\.|$)/i, '全局偏移表（GOT）', '保存动态链接后的地址项，位置无关代码通过它访问外部函数或全局对象。加载器会在重定位阶段更新部分内容。'],
  [/^\.(?:rela?|relr)(?:\.|$)/i, '重定位信息', '记录加载器需要修正的地址位置、符号和重定位类型，本身通常不是业务代码或运行时变量。'],
  [/^\.dynamic(?:\.|$)/i, '动态链接信息', '记录依赖库、字符串表、符号表、重定位表等动态加载元数据。'],
  [/^\.dynsym(?:\.|$)/i, '动态符号表', '保存动态链接器可见的导入、导出符号，通常比完整调试符号表更精简。'],
  [/^\.dynstr(?:\.|$)/i, '动态字符串表', '保存动态符号名称、依赖库名称等动态链接字符串。'],
  [/^\.symtab(?:\.|$)/i, '完整符号表', '保存链接或调试使用的函数、变量等符号。发布文件被 strip 后可能不存在。'],
  [/^\.strtab(?:\.|$)/i, '符号字符串表', '保存完整符号表引用的名称字符串。'],
  [/^\.interp(?:\.|$)/i, '动态加载器路径', '指定启动该 ELF 所使用的程序解释器，例如 Linux 动态加载器 ld-linux。'],
  [/^\.eh_frame(?:\.|$)/i, '栈展开信息', '保存异常处理和调用栈回溯所需的展开规则，调试器、异常机制和崩溃回溯会使用它。'],
  [/^\.gcc_except_table(?:\.|$)/i, '异常处理表', '保存 C++ 等语言异常处理使用的区域和动作信息。'],
  [/^\.note(?:\.|$)/i, 'ELF 注记信息', '保存构建 ID、ABI、平台属性等描述性元数据。'],
  [/^\.(?:gnu\.)?hash(?:\.|$)/i, '动态符号哈希表', '动态加载器用它快速查找导出符号，减少逐项扫描动态符号表的开销。'],
  [/^\.gnu\.version(?:_r|_d)?(?:\.|$)/i, '符号版本信息', '记录动态符号的版本编号、所需版本和已定义版本，用于检查共享库 ABI 是否兼容。'],
  [/^\.(?:init|fini)(?:\.|$)/i, '启动/退出代码', '由运行库在 main 前或进程退出阶段执行的小段代码，通常用于初始化和清理。'],
  [/^\.preinit_array(?:\.|$)/i, '预初始化函数表', '仅主程序使用的早期初始化函数地址表，执行顺序早于 init_array。'],
  [/^\.(?:arm\.exidx|arm\.extab)(?:\.|$)/i, 'ARM 栈展开信息', 'ARM 异常处理和调用栈回溯使用的紧凑展开表。'],
  [/^\.arm\.attributes(?:\.|$)/i, 'ARM 架构属性', '描述目标指令集、浮点 ABI 和处理器能力，链接器用它检查目标文件兼容性。'],
  [/^\.(?:debug|zdebug)(?:\.|$)/i, '调试信息', '保存源文件、行号、类型和变量等调试数据。通常不映射到运行内存，可被 strip 分离。'],
  [/^\.comment(?:\.|$)/i, '工具链备注', '保存编译器或汇编器版本等文本信息，不属于程序运行时资源。'],
  [/^\.(?:ctors|dtors)(?:\.|$)/i, '构造/析构函数表', '旧式工具链使用的初始化或退出函数地址表。'],
  [/^\.(?:heap)(?:\.|$)/i, '堆空间', '动态内存分配器使用的区域。实际使用量随程序运行而变化，静态文件通常只能看到预留范围。'],
  [/^\.(?:stack)(?:\.|$)/i, '栈空间', '保存函数调用帧、局部变量和返回地址。实际地址和用量与线程及运行状态有关。']
];

const categoryHelp = {
  code: ['可执行代码', '主要保存处理器执行的机器指令。'],
  rodata: ['只读资源', '保存运行时只读的常量、字符串或链接元数据。'],
  data: ['可写静态数据', '保存运行期间可修改的全局或静态数据。'],
  bss: ['零初始化内存', '运行时需要内存，但初始零值通常不占用对应的文件数据空间。'],
  other: ['其他 ELF 区域', '可能是链接器元数据、平台信息或工具链生成的辅助区域。']
};

function permissionFlags(attributes = '') {
  const tokens = String(attributes).toUpperCase().split(/[^A-Z]+/).filter(Boolean);
  const compact = tokens.find((token) => /^[RWXE]+$/.test(token)) || '';
  return {
    readable: tokens.includes('READ') || compact.includes('R'),
    writable: tokens.includes('WRITE') || compact.includes('W'),
    executable: tokens.includes('EXEC') || tokens.includes('EXECUTE') || compact.includes('X') || compact.includes('E')
  };
}

export function permissionDescription(attributes = '') {
  const flags = permissionFlags(attributes);
  const permissions = [];
  if (flags.readable) permissions.push('R：允许读取');
  if (flags.writable) permissions.push('W：允许写入');
  if (flags.executable) permissions.push('X/E：允许执行');
  return permissions.length ? permissions.join('；') : '文件或链接器未提供明确的访问权限。';
}

export function explainMemoryItem({ name = '', category = 'other', type = '', attributes = '', kind = '' } = {}) {
  if (kind === 'module') return { role: '模块虚拟地址范围', description: '表示一个 ELF 或共享库在当前视图中的完整地址跨度。内部的代码、只读数据、静态数据和 BSS 会在该范围内进一步划分。', permissions: permissionDescription(attributes) };
  if (/^LOAD\b/i.test(name)) {
    const flags = permissionFlags(attributes);
    const role = flags.writable ? '可写加载段（PT_LOAD）' : flags.executable ? '可执行加载段（PT_LOAD）' : '只读加载段（PT_LOAD）';
    const description = flags.writable
      ? '动态加载器把该范围映射为可写内存，通常包含 .data、.bss、GOT 和运行时会被修改的链接信息。文件大小小于内存大小的尾部会在加载时补零。'
      : flags.executable
        ? '动态加载器把该范围映射为可执行内存，通常包含 .init、.plt、.text 和 .fini 等机器代码。'
        : '动态加载器把该范围映射为只读内存，通常包含 ELF 头、动态符号、重定位信息、字符串和只读常量。';
    return { role, description, permissions: permissionDescription(attributes) };
  }
  if (type === 'function') return { role: '函数符号', description: '表示一段可调用的机器代码。符号地址通常指向函数入口，大小表示工具链记录的函数代码范围。', permissions: permissionDescription(attributes) };
  if (type === 'object') return { role: '变量符号', description: '表示全局变量、静态变量或其他数据对象。所在 section 决定它是否只读、是否具有初始值以及是否占用文件空间。', permissions: permissionDescription(attributes) };
  const match = sectionHelp.find(([pattern]) => pattern.test(name));
  const fallback = categoryHelp[category] || categoryHelp.other;
  return {
    role: match?.[1] || fallback[0],
    description: match?.[2] || fallback[1],
    permissions: permissionDescription(attributes)
  };
}
