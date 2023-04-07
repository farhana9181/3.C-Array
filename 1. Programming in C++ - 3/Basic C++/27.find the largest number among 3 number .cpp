#include <iostream>
using namespace std;
int main()
{
   int x,y,z;

   cout<<"Enter three number = "<<endl;
   cin>>x>>y>>z;
   if(x>y && x>z)
   {
       cout<<"**  "<<x<<" is larger number among  "<<x<<","<<y<<","<<z<<"  **";
   }else if(y>z && y>x)
   {
       cout<<"**  "<<y<<" is larger number among  "<<x<<","<<y<<","<<z<<"  **";
   }else
   {
    cout<<"**  "<<z<<" is larger number among  "<<x<<","<<y<<","<<z<<"  **";
   }
}
