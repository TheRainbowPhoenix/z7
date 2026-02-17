import math

def Array_Any_Length(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: UDInt
    # VAR_INPUT:
    #   array: Variant
    # VAR_TEMP:
    #   status: DInt
    #   ret: UDInt
    context['ret'] = CountOfElements(context['array'])
    context['Array.Any.Length'] = context['ret']


def WString_Find_Multiple_Breadth(context=None, global_dbs=None, **kwargs):
    if context is None: context = {}
    if global_dbs is None: global_dbs = {}
    for k, v in kwargs.items():
        context[k] = v
    # Return Type: Int
    # VAR_INPUT:
    #   body: WString
    #   terms: Array[*] of WString[1]
    # VAR_TEMP:
    #   _i: Int
    #   _length: UDInt
    #   _min: Int
    #   _position: Int
    # VAR CONSTANT:
    #   BLANK: WString
    context['_length'] = Array_Any_Length(context['terms'])
    if ((context['_length'] == 0) or (context['body'] == context['BLANK'])):
        context['WString.Find_Multiple.Breadth'] = 0
        return
    for _loop_var_1 in range(int(0), int((UDINT_TO_INT(context['_length']) - 1)) + 1):
        context['_i'] = _loop_var_1
        context['_position'] = FIND(IN1=context['body'], IN2=context['terms'][int(context['_i'])])
        if (context['_position'] == 0):
            context['CONTINUE']
        if ((context['_position'] < context['_min']) or (context['_min'] == 0)):
            context['_min'] = context['_position']
    context['WString.Find_Multiple.Breadth'] = context['_min']
