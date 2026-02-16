import math

def Int___IsFull(context, global_dbs):
    # Return Type: Bool
    # VAR_INPUT:
    #   array: Array[*] of Int
    #   null_value: Int
    # VAR_TEMP:
    #   i: DInt
    #   size: DInt
    context['REGION']
    context['NOTES']
    context['END_REGION']
    context['REGION']
    global_dbs['GET ARRAY SIZE']
    context['size'] = UDINT_TO_DINT(Int___CountOfElements(context['array']))
    context['END_REGION']
    context['REGION']
    global_dbs['CHECK VALUES']
    for _loop_var_1 in range(int(0), int((context['size'] - 1)) + 1):
        context['i'] = _loop_var_1
        if (context['array'][int(context['i'])] == context['null_value']):
            context['Int[].IsFull'] = False
            return
    context['END_REGION']
    context['REGION']
    global_dbs['ALL VALUES NULL']
    context['Int[].IsFull'] = True
    context['END_REGION']
