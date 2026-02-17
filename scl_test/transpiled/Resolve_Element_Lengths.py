import math

def Resolve_Element_Lengths(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Void
    # VAR_INPUT:
    #   formatCodes: String Buffer
    # VAR_OUTPUT:
    #   elementLengths: Element Lengths
    #   error message: String
    # VAR_TEMP:
    #   code: String
    #   pCode: Int
    #   errorFlag: Bool
    context['errorFlag'] = True
    for _loop_var_1 in range(int(0), int(9) + 1):
        context['pCode'] = _loop_var_1
        context['code'] = context['formatCodes'].me[int(context['pCode'])]
        if (context['code'] == ''):
            return
        if (FIND(IN1=context['code'], IN2='Y') != 0):
            context['elementLengths'].year = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='M') != 0):
            context['elementLengths'].month = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='D') != 0):
            context['elementLengths'].day = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='H') != 0):
            context['elementLengths'].hour = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='I') != 0):
            context['elementLengths'].minute = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        if (FIND(IN1=context['code'], IN2='S') != 0):
            context['elementLengths'].second = LEN(context['code'])
            context['errorFlag'] = False
            pass # GOTO NEXT (Not supported)
        pass # LABEL NEXT
    if context['errorFlag']:
        context['error message'] = 'no valid format code found'
