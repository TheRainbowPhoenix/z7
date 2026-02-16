import math

def ADP_Decode_Horizontal_Alignment(context, global_dbs):
    # Return Type: String
    # VAR_INPUT:
    #   horizontal_alignment: String
    #   decoded: ADP: Decoded: Horizontal Alignment
    #   encoded: ADP: Encoded: Formatting: Horizontal Alignment
    # VAR_TEMP:
    #   _return: String
    if (context['horizontal_alignment'] == context['encoded'].center):
        context['_return'] = context['decoded'].center
        # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['encoded'].left):
        context['_return'] = context['decoded'].left
        # GOTO RTRN (Not supported)
    if (context['horizontal_alignment'] == context['encoded'].right):
        context['_return'] = context['decoded'].right
        # GOTO RTRN (Not supported)
    # LABEL RTRN
    context['ADP: Decode: Horizontal Alignment'] = context['_return']
