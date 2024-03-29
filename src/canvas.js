function getType(node) {
    if (node._type == 'rect') {
        return 'view'
    }
    if (node._type == 'root') {
        return 'view'
    }
    if (node._type == 'group') {
        return 'view'
    }
    return node._type || node.type || 'view'
}

const Types = {
    Image: 'image',
    Circle: 'circle',
    Path: 'path',
    Ellipse: 'ellipse',
    Line: 'line',
    Polyline: 'polyline',
    Polygon: 'polygon',
}

class CanvasX {

    constructor(opts = {}) {
        this.debug = !!opts.debug
        this.painter = new opts.Painter()
    }

    async render(oldRoot) {
        let renderParam = {}

        // throw Error('root2 is empty')

        if (!oldRoot) {
            throw Error('root is empty')
        }

        let startTime = new Date().getTime()

        let root = JSON.parse(JSON.stringify(oldRoot))

        let _this = this

        this.painter.init(this)

        let allImage = [] // 所有的图片

        // 处理布局，相对元素的位置 TODO 代码荣誉
        function preProcessLayout(node, parent, lastChild, selfIndex) {
            if (node.debug) {
                console.log('debug node', node)
            }
            const {
                x,
                y,
            } = node

            

            // x
            node._x = x
            if (x === undefined) {
                if (getType(node) === Types.Circle) {
                    node._x = node.cx - node.radius
                }
                else if (getType(node) === Types.Ellipse) {
                    node._x = node.cx - node.rx
                }
                else {
                    node._x = parent ? (parent._x + parent._padding.left + node._margin.left) : 0
                }

                // cjh
            } else if (x === 'left') {
                node._x = parent ? (parent._x + parent._padding.left) : 0
            } else if (x === 'center') {
                node._x = parent._x + parent._width / 2 - node._width / 2
            }

            // y
            node._y = y
            if (y === undefined) {
                if (getType(node) === Types.Circle) {
                    node._y = node.cy - node.radius
                }
                else if (getType(node) === Types.Ellipse) {
                    node._y = node.cy - node.ry
                }
                else if (lastChild) {
                    node._y = lastChild._y + lastChild._height + lastChild._margin.bottom + node._margin.top
                } else {
                    node._y = parent ? (parent._y + parent._padding.top + node._margin.top) : 0
                }
            }

            if (parent && parent.layout === 'x') {
                if (parent.yAlign === 'center') { // TODO 怎么用
                    node._y = parent._y + parent._height / 2 - node._height / 2
                } else {
                    node._y = parent._y + parent._padding.top + node._margin.top
                }
                if (lastChild) {
                    // node._x = lastChild._x + lastChild._width
                    node._x = lastChild._x + lastChild._width + lastChild._margin.right + node._margin.right
                } else {
                    node._x = parent ? (parent._x + parent._padding.left + node._margin.left) : 0
                }
            }

            if (parent && parent.layout === 'grid') {
                const { gridSize = 3, gridHeight = 80, grid = {} } = parent
                const { gutterX = 0, gutterY = 0 } = grid
                let row = Math.floor(selfIndex / gridSize)
                let col = selfIndex % gridSize
                let gridWidth = (parent._innerWidth - gutterX * (gridSize - 1)) / gridSize
                node._x = parent._x + parent._padding.left + col * (gridWidth + gutterX)
                node._y = parent._y + parent._padding.top + row * (gridHeight + gutterY)
                node._width = gridWidth
                node._height = gridHeight
                // node._y = parent._y + parent._height / 2 - node._height / 2
                // if (parent.yAlign === 'center') {
                // } else {
                //     node._y = parent._y + parent._padding.top + node._margin.top
                // }
                // if (lastChild) {
                //     // node._x = lastChild._x + lastChild._width
                //     node._x = lastChild._x + lastChild._width + lastChild._margin.right + node._margin.right
                // } else {
                //     node._x = parent ? (parent._x + parent._padding.left + node._margin.left) : 0
                // }
            }

            // 相对布局
            if (node.relative === 'parent' && parent) {
                if (x === 'center') {
                    node._x = parent._x + parent._width / 2 - node._width / 2
                } else {
                    if (node.right !== undefined) {
                        node._x = parent._x + parent._width - node._width - node._right + node._margin.right
                    } else {
                        node._x = parent._x + node._left + node._margin.left
                        // node._x = 0
                    }
                }
                // calculate y
                if (y === 'center') {
                    node._y = parent._y + parent._height / 2 - (getType(node) === 'text' ? node._oneLineHeight : node._height) / 2
                } else {
                    if (node.top !== undefined) {
                        node._y = parent._y + node._top
                    } else {
                        node._y = parent._y + parent._height - node._height - node._bottom
                    }
                }
            }

            return node
        }

        // 预处理
        const preProcess = (node, parent, lastChild, selfIndex) => {
            // console.log('预处理', node, parent)
            if (node.debug) {
                console.log('debug node', node)
            }
            const {
                // type = 'node',
                color = '#999',
                x,
                y,
                width = 'auto',
                height = 'auto',
                minHeight,
                minWidth,
                maxWidth,
                maxHeight,
                borderRadius = 0,
                margin,
                marginTop,
                marginBottom,
                marginRight,
                marginLeft,
                padding,
                visible = true,

                textColor,
                textSize,
            } = node

            // text color，默认继承父节点，否则 #000
            node._textColor = textColor || node.color
            if (node._textColor === undefined) {
                node._textColor = (parent ? parent._textColor : '') || '#000'
            }

            // text size，默认继承父节点，没有则 0
            node._textSize = textSize
            if (node._textSize === undefined) {
                node._textSize = (parent ? parent._textSize : '') || 12
            }

            // width
            node._width = width
            if (getType(node) === Types.Circle) {
                node._width = node.radius * 2
                console.log('远啊', node)
            }
            else if (getType(node) === Types.Ellipse) {
                node._width = node.rx * 2
            }
            else if (node._width === 'auto') {
                node._width = parent ? parent._innerWidth : 999
            } else if (typeof width === 'string') {
                // 只支持百分比的形式
                // 假设父节点存在
                node._width = parseInt(node._width.replace('%')) / 100 * parent._width
            }

            // border radius
            node._borderRadius = borderRadius
            if (typeof node._borderRadius === 'string') {
                // if (node._borderRadius.if )
                // only like 50%
                node._borderRadius = parseInt(node._borderRadius.replace('%')) / 100 * node._width
            }

            // height
            node._height = height
            if (getType(node) === Types.Circle) {
                node._height = node.radius * 2
            }
            else if (getType(node) === Types.Ellipse) {
                node._height = node.ry * 2
            }
            else if (node._height === 'auto') {
                // 在后面处理
            } else if (typeof node._height === 'string') {
                // 只支持百分比的形式
                // 假设父节点存在
                node._height = parseInt(node._height.replace('%')) / 100 * parent._height
            }

            // left
            node._left = node.left
            if (typeof node._left === 'string') {
                // 只支持百分比的形式
                // 假设父节点存在
                node._left = parseInt(node._left.replace('%')) / 100 * parent._width
            }

            // top
            node._top = node.top
            if (typeof node._top === 'string') {
                // 只支持百分比的形式
                // 假设父节点存在
                node._top = parseInt(node._top.replace('%')) / 100 * parent._height
            }

            // right
            node._right = node.right
            if (typeof node._right === 'string') {
                // 只支持百分比的形式
                // 假设父节点存在
                node._right = parseInt(node._right.replace('%')) / 100 * parent._width
            }

            // bottom
            node._bottom = node.bottom
            if (typeof node._bottom === 'string') {
                // 只支持百分比的形式
                // 假设父节点存在
                node._bottom = parseInt(node._bottom.replace('%')) / 100 * parent._height
            }

            // margin TODO
            let _margin = margin
            // cobns
            if (margin === undefined) {
                _margin = {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                }
            } else if (typeof margin === 'number') {
                _margin = {
                    top: margin,
                    right: margin,
                    bottom: margin,
                    left: margin,
                }
            } else if (Array.isArray(margin)) {
                if (margin.length === 2) {
                    _margin = {
                        top: margin[0],
                        right: margin[1],
                        bottom: margin[0],
                        left: margin[1],
                    }
                } else if (margin.length === 4) {
                    _margin = {
                        top: margin[0],
                        right: margin[1],
                        bottom: margin[2],
                        left: margin[3],
                    }
                }
            }
            node._margin = _margin
            if (marginTop !== undefined) {
                node._margin.top = marginTop
            }
            if (marginRight !== undefined) {
                node._margin.right = marginRight
            }
            if (marginBottom !== undefined) {
                node._margin.bottom = marginBottom
            }
            if (marginLeft !== undefined) {
                node._margin.left = marginLeft
            }

            // padding
            let _padding = padding
            if (padding === undefined) {
                _padding = {
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                }
            } else if (typeof padding === 'number') {
                _padding = {
                    top: padding,
                    right: padding,
                    bottom: padding,
                    left: padding,
                }
            } else if (Array.isArray(padding)) {
                if (padding.length === 2) {
                    _padding = {
                        top: padding[0],
                        right: padding[1],
                        bottom: padding[0],
                        left: padding[1],
                    }
                } else if (padding.length === 4) {
                    _padding = {
                        top: padding[0],
                        right: padding[1],
                        bottom: padding[2],
                        left: padding[3],
                    }
                }
            }
            node._padding = _padding
            if (node.paddingTop !== undefined) {
                node._padding.top = node.paddingTop
            }
            if (node.paddingRight !== undefined) {
                node._padding.right = node.paddingRight
            }
            if (node.paddingBottom !== undefined) {
                node._padding.bottom = node.paddingBottom
            }
            if (node.paddingLeft !== undefined) {
                node._padding.left = node.paddingLeft
            }

            // image type
            if (getType(node) === Types.Image) {
                allImage.push(node.url)
            }

            // text type
            if (getType(node) === 'text') {
                const { textSize, lineHeight, textAlign, fontFamily } = node

                // font size
                node._textSize = textSize
                if (node._textSize === undefined) {
                    const defaultTextSize = 12
                    node._textSize = (parent ? parent._textSize : defaultTextSize) || defaultTextSize
                }

                // line height
                node._lineHeight = lineHeight
                if (node._lineHeight === undefined) {
                    node._lineHeight = node._textSize // 继承？
                }

                // text align
                node._textAlign = textAlign
                if (node._textAlign === undefined) {
                    const defaultTextAlign = 'left'
                    node._textAlign = (parent ? parent._textAlign : defaultTextAlign) || defaultTextAlign
                }

                // font family
                node._fontFamily = fontFamily
                if (node._fontFamily === undefined) {
                    const defaultFontFamilly = 'sans-serif'
                    node._fontFamily = (parent ? parent._fontFamily : defaultFontFamilly) || defaultFontFamilly
                }

                // font weight
                node._fontWeight = node.fontWeight || ''

                let { textLine, textHeight, oneLineWidth, oneLineHeight } = this.painter.calText(node.text, 0, 0, node._width, node._lineHeight, node, {
                    textSize: node._textSize,
                    originWidth: width,
                    fontFamily: node._fontFamily
                })
                // if (line)
                node._textLine = textLine
                node._height = textHeight
                if (width === 'auto') {
                    node._width = oneLineWidth
                }

                node._oneLineWidth = oneLineWidth
                node._oneLineHeight = oneLineHeight
            }

            // x
            node._x = x
            if (x === undefined) {
                node._x = parent ? (parent._x + parent._padding.left + node._margin.left) : 0
            } else if (x === 'left') {
                node._x = parent ? (parent._x + parent._padding.left) : 0
            } else if (x === 'center') {
                node._x = parent._x + parent._width / 2 - node._width / 2
            }

            // y
            node._y = y
            if (y === undefined) {
                if (lastChild) {
                    node._y = lastChild._y + lastChild._height + lastChild._margin.bottom + node._margin.top
                } else {
                    node._y = parent ? (parent._y + parent._padding.top + node._margin.top) : 0
                }
            }

            // if (node.layout === 'x') {
            //     if (node.children && node.children.length) {
            //         let totalRate = 0
            //         for (let idx = 0; idx < children.length; idx++) {
            //             // let child = children[i]
            //             // if (node.)
            //             // totalRate += 

            //         }
            //     }
            // }
            if (parent && parent.layout === 'x') {
                if (parent.yAlign === 'center') { // TODO 怎么用
                    node._y = parent._y + parent._height / 2 - node._height / 2
                } else {
                    node._y = parent._y + parent._padding.top + node._margin.top
                }
                if (lastChild) {
                    node._x = lastChild._x + lastChild._width + lastChild._margin.right + node._margin.right
                } else {
                    node._x = parent ? (parent._x + parent._padding.left + node._margin.left) : 0
                }
            }

            if (parent && parent.layout === 'grid') {
                const { gridSize = 3, gridHeight = 80, grid = {} } = parent
                const { gutterX = 0, gutterY = 0 } = grid
                let row = Math.floor(selfIndex / gridSize)
                let col = selfIndex % gridSize
                let gridWidth = (parent._innerWidth - gutterX * (gridSize - 1)) / gridSize
                node._x = parent._x + parent._padding.left + col * (gridWidth + gutterX)
                node._y = parent._y + parent._padding.top + row * (gridHeight + gutterY)
                node._width = gridWidth
                node._height = gridHeight
                // node._y = parent._y + parent._height / 2 - node._height / 2
                // if (parent.yAlign === 'center') {
                // } else {
                //     node._y = parent._y + parent._padding.top + node._margin.top
                // }
                // if (lastChild) {
                //     // node._x = lastChild._x + lastChild._width
                //     node._x = lastChild._x + lastChild._width + lastChild._margin.right + node._margin.right
                // } else {
                //     node._x = parent ? (parent._x + parent._padding.left + node._margin.left) : 0
                // }
            }


            // node._y = 40



            if (node.css) {
                let css = node.css
                let arr = css.split('\n').map(item => item.replace(/^\s+/, '').replace(/\s+$/, '').replace(/;/, '')).filter(item => item)
                for (let item of arr) {
                    let kv = item.split(':')
                    let key = kv[0].replace(/^\s+/, '').replace(/\s+$/, '')
                    let value = kv[1].replace(/^\s+/, '').replace(/\s+$/, '')
                    if (key === 'width') {
                        node.width = value.replace('px', '')
                    }
                    if (key === 'height') {
                        node.height = value.replace('px', '')
                    }
                }
            }

            // 文字计算行、高度
            // 流式布局 干嘛的？
            if (node.position === 'static') {
                if (lastChild) { // TODO
                    node._y = lastChild._y + lastChild._height + lastChild._margin.bottom
                    // console.log('计算', node._y)
                }
            }
            // 相对布局
            if (node.relative === 'parent' && parent) {
                // node._x = parent._x + parent._width
                // node._y = parent._y + node._y
                // calculate x
                if (x === 'center') {
                    node._x = parent._x + parent._width / 2 - node._width / 2
                } else {
                    if (node.right !== undefined) {
                        node._x = parent._x + parent._width - node._width - node._right + node._margin.right
                    } else {
                        node._x = parent._x + node._left + node._margin.left
                    }
                }
                // calculate y
                if (y === 'center') {
                    node._y = parent._y + parent._height / 2 - (getType(node) === 'text' ? node._oneLineHeight : node._height) / 2
                } else {
                    if (node.top !== undefined) {
                        node._y = parent._y + node._top
                    } else {
                        node._y = parent._y + parent._height - node._height - node._bottom
                    }
                }
            }



            // inner width & inner height
            node._innerWidth = node._width - node._padding.left - node._padding.right
            if (node.debug) {

                // console.log('_innerWidth', node._innerWidth, node._width, node._padding.left, node._padding.right)
            }
            node._innerHeight = node._height - node._padding.top - node._padding.bottom

            // visible
            node._visible = !!visible

            // parent
            node._parent = parent

            // height auto
            let maxRight
            let maxBottom
            if (node.children && node.children.length) {
                let children = node.children
                let lastChild = null
                for (let idx = 0; idx < children.length; idx++) {
                    let child = node.children[idx]
                    let _node = preProcess(child, node, lastChild, idx)
                    if (_node.relative) {
                        continue
                    }
                    if (!child.relative) { // TODO
                        lastChild = _node
                    }
                    let right = _node._x + _node._width + _node._margin.right
                    let bottom = _node._y + _node._height + _node._margin.bottom
                    if (idx === 0) {
                        maxRight = right
                        maxBottom = bottom
                    } else {
                        if (right > maxRight) {
                            maxRight = right
                        }
                        if (bottom > maxBottom) {
                            maxBottom = bottom
                            // console.log('maxBottom node', _node)
                        }
                    }
                }
            }

            

            
            if (node._height === 'auto') {
                if (node.children && node.children.length) {
                    let innerHeight = maxBottom - node._y - node._padding.top
                    node._innerHeight = innerHeight
                    node._height = innerHeight + node._padding.top + node._padding.bottom
                } else {
                    node._height = 0
                }
            }

            // 递归处理子元素布局
            if (node.children && node.children.length) {
                let children = node.children
                let lastChild = null
                for (let idx = 0; idx < children.length; idx++) {
                    let child = node.children[idx]
                    let _node = preProcessLayout(child, node, lastChild, idx)
                    if (!child.relative) { // TODO
                        lastChild = _node
                    }
                }
            }

            // min width
            if (minWidth !== undefined && node._width < minWidth) {
                node._width = minWidth
            }

            // min height
            if (minHeight !== undefined && node._height < minHeight) {
                node._height = minHeight
            }

            // max width
            if (maxWidth !== undefined && node._width > maxWidth) {
                node._width = maxWidth
            }

            // max height
            if (maxHeight !== undefined && node._height > maxHeight) {
                node._height = maxHeight
            }

            return node
        }

        preProcess(root, null, null, undefined)
        
        // console.log('预处理后', root)

        this._root = root

        let { requestImageTime } = await this.painter.loadImages(allImage)
        renderParam.requestImageTime = requestImageTime

        this.painter.setSize(root.width, root.height)

        this.painter.clear()

        const drawNode = async (node) => {
            // console.log('画画', node)
            const {
                color,
                borderRadius = 0,

                _x,
                _y,
                _width,
                _height,
                _innerHeight,
                _padding,
                _margin,
                _visible,
            } = node

            const __type = getType(node)

            this.painter.beforeDrawNode && this.painter.beforeDrawNode(node)


            let drawOutline = false

            if (_visible) {

                function getStyle(node) {
                    let style = {}

                    // fill
                    if (node.gradient) {
                        // gradient
                        style.fill = {
                            gradient: {
                                from: node.gradient.from,
                                to: node.gradient.to,
                            }
                        }
                    } else if (node.color) {
                        // fill color
                        style.fill = {
                            color,
                        }
                    }

                    style.radius = borderRadius

                    if (color) {
                    } else {
                        drawOutline = true
                    }
                    // border
                    if (node.border) {
                        const { color = '#000', width = 1, dash = [] } = node.border
                        let stroke = {
                            color,
                            width,
                            dash,
                        }
                        style.stroke = stroke
                    }

                    if (node.opacity == undefined) {
                        style.opacity = 1
                    }
                    else {
                        style.opacity = node.opacity
                    }
                    return style
                }

                if (__type === 'view') {
                    
                    this.painter.drawRect(_x, _y, _width, _height, getStyle(node), node.shadow)
                }
                if (__type === Types.Circle) {
                    let style = {}

                    // fill
                    if (node.gradient) {
                        // gradient
                        style.fill = {
                            gradient: {
                                from: node.gradient.from,
                                to: node.gradient.to,
                            }
                        }
                    } else if (node.color) {
                        // fill color
                        style.fill = {
                            color,
                        }
                    }

                    style.radius = borderRadius

                    if (color) {
                    } else {
                        drawOutline = true
                    }
                    // border
                    if (node.border) {
                        const { color = '#000', width = 1, dash = [] } = node.border
                        let stroke = {
                            color,
                            width,
                            dash,
                        }
                        style.stroke = stroke
                    }
                    this.painter.drawCircle(_x, _y, _width, _height, style)
                }
                if (__type === Types.Ellipse) {
                    let style = {}

                    // fill
                    if (node.gradient) {
                        // gradient
                        style.fill = {
                            gradient: {
                                from: node.gradient.from,
                                to: node.gradient.to,
                            }
                        }
                    } else if (node.color) {
                        // fill color
                        style.fill = {
                            color,
                        }
                    }

                    style.radius = borderRadius

                    if (color) {
                    } else {
                        drawOutline = true
                    }
                    // border
                    if (node.border) {
                        const { color = '#000', width = 1, dash = [] } = node.border
                        let stroke = {
                            color,
                            width,
                            dash,
                        }
                        style.stroke = stroke
                    }
                    this.painter.drawEllipse(_x, _y, _width, _height, style)
                }
                if (__type === Types.Path) {
                    let style = {}

                    // fill
                    if (node.gradient) {
                        // gradient
                        style.fill = {
                            gradient: {
                                from: node.gradient.from,
                                to: node.gradient.to,
                            }
                        }
                    } else if (node.color) {
                        // fill color
                        style.fill = {
                            color,
                        }
                    }

                    style.radius = borderRadius

                    if (color) {
                    } else {
                        drawOutline = true
                    }
                    // border
                    if (node.border) {
                        const { color = '#000', width = 1, dash = [] } = node.border
                        let stroke = {
                            color,
                            width,
                            dash,
                        }
                        style.stroke = stroke
                    }
                    this.painter.drawPath(node.d, style)
                }
                if (__type === Types.Line) {
                    let dash
                    if (node.lineStyle === 'dashed') {
                        dash = [8, 8]
                    } else {
                        dash = []
                    }
                    // TODO
                    this.painter.drawLine([{ x: node.x || node.x1, y: node.y || node.y1}, {x: node.x2, y: node.y2}], {
                        stroke: {
                            color: color,
                        },
                        fill: null,
                        line: {
                            dash,
                        }
                    })

                }
                if (__type === Types.Polyline) {
                    let dash
                    if (node.lineStyle === 'dashed') {
                        dash = [8, 8]
                    } else {
                        dash = []
                    }
                    // TODO
                    this.painter.drawPolyline(node.points, {
                        stroke: {
                            color: color,
                        },
                        fill: null,
                        line: {
                            dash,
                        }
                    })

                }
                if (__type === Types.Polygon) {
                    // fill
                    // let fill = null
                    // if (node.gradient) {
                    //     // gradient
                    //     fill = {
                    //         gradient: {
                    //             from: node.gradient.from,
                    //             to: node.gradient.to,
                    //         }
                    //     }
                    // } else if (node.color) {
                    //     // fill color
                    //     fill = {
                    //         color,
                    //     }
                    // }

                    // let dash
                    // if (node.lineStyle === 'dashed') {
                    //     dash = [8, 8]
                    // } else {
                    //     dash = []
                    // }
                    // TODO
                    this.painter.drawPolygon(node.points, getStyle(node))

                }
                if (__type === Types.Image) {
                    this.painter.drawImage(node.url, _x, _y, _width, _height, {
                        radius: node._borderRadius
                    })
                    drawOutline = true
                }
                if (__type === 'text') {
                    console.log('画画文字')
                    this.painter.drawText(node.text, _x, _y, _width, node._lineHeight, {
                        textAlign: node._textAlign,
                        originWidth: node.width,
                    }, node)

                    drawOutline = true
                }
                
            }

            if (_this.debug) {
                this.painter.drawRect(_x, _y, _width, _height, {
                    stroke: {
                        color: '#999',
                        dash: [8, 8]
                    }
                })
            }
            if (node.strong) {
                this.painter.drawRect(_x, _y, _width, _height, {
                    stroke: {
                        color: node.strong,
                        width: 8,
                    }
                })
            }

            // draw box for debug
            if (node.debug) {
                // border
                this.painter.drawRect(_x, _y, _width, _height, {
                    stroke: {
                        color: 'rgba(255, 0, 0, .4)',
                        width: 1, // TODO by border width
                    }
                })

                // padding
                let paddingStyle = {
                    fill: {
                        color: 'rgba(193, 195, 74, .4)'
                    }
                }
                let inTop = _y + _padding.top
                let inBottom = _y + _height - _padding.bottom
                // padding top
                if (_padding.top > 0) {
                    this.painter.drawRect(_x, _y, _width, _padding.top, paddingStyle)
                }
                // padding left
                if (_padding.left > 0) {
                    this.painter.drawRect(_x, inTop, _padding.left, _innerHeight, paddingStyle)
                }
                // padding right
                if (_padding.right > 0) {
                    this.painter.drawRect(_x + _width - _padding.right, inTop, _padding.right, _innerHeight, paddingStyle)
                }
                // padding bottom
                if (_padding.bottom > 0) {
                    this.painter.drawRect(_x, inBottom, _width, _padding.bottom, paddingStyle)
                }

                // margin
                let marginStyle = {
                    fill: {
                        color: 'rgba(249, 104, 157, .4)'
                    }
                }
                // margin top
                if (_margin.top > 0) {
                    this.painter.drawRect(_x - _margin.left, _y - _margin.top, _width + _margin.left + _margin.right, _margin.top, marginStyle)
                }
                // margin left
                if (_margin.left > 0) {
                    this.painter.drawRect(_x - _margin.left, _y, _margin.left, _height, marginStyle)
                }
                // margin right
                if (_margin.right > 0) {
                    this.painter.drawRect(_x + _width, _y, _margin.right, _height, marginStyle)
                }
                // margin bottom
                if (_margin.bottom > 0) {
                    this.painter.drawRect(_x - _margin.left, _y + node._height, _width + _margin.left + _margin.right, _margin.bottom, marginStyle)
                }
            }

            if (node.children && node.children.length) {
                for (let child of node.children) {
                    await drawNode(child)
                }
            }
        }

        await drawNode(root)

        async function forEachNode(node, callback) {

            callback && callback(node)

            if (node.children && node.children.length) {
                for (let child of node.children) {

                    forEachNode(child, callback)
                }
            }
        }

        // forEachNode(root, node => {
        //     const {
        //         type = 'view',
        //         color,
        //         x = 0,
        //         y = 0,
        //         width = 0,
        //         height = 0,
        //         borderRadius = 0,

        //         _x,
        //         _y,
        //         _width,
        //         _height,
        //         _innerWidth,
        //         _innerHeight,
        //         _padding,
        //         _margin,
        //         _visible,
        //     } = node

        let time = new Date().getTime() - startTime
        console.log(`耗时：${time}ms`)

        renderParam.totalTime = time

        return renderParam
    }
}

// export { CanvasX }


module.exports = {
    CanvasX,
}
